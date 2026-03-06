from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from decimal import Decimal
from email.message import EmailMessage
from functools import wraps
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from sqlalchemy import inspect, text

from models import AuthToken, Comment, Course, CourseSection, EmailStatus, Enrollment, PaymentMethod, Progress, Purchase, Referral, SectionContent, SupportEntry, User, db


DATABASE_PATH = os.path.join(os.path.dirname(__file__), "academy.db")
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
DEFAULT_FRONTEND_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
DEFAULT_SUPPORT_FAQ = [
    "Como desbloqueo un curso premium despues del pago?",
    "Como funciona el progreso y el marcado de secciones?",
    "Que hago si no puedo iniciar sesion o no veo mi compra?",
    "Como usar el documento gratuito antes de comprar?",
]
DEFAULT_SUPPORT_KNOWLEDGE = [
    "Los cursos premium se desbloquean para la cuenta que hizo la compra y el progreso queda guardado por seccion.",
    "Si abres un curso en otra pesta?a, la sesion se revalida con cookies y sincronizacion al volver a enfocarla.",
    "Cada seccion puede incluir documento, video obligatorio, actividad guiada y un quiz tactico.",
    "El admin puede crear nuevas rutas con secciones, video, resumen accesible y contenido bloqueado o gratuito.",
]

RATE_LIMIT_STATE: dict[str, list[float]] = {}
RATE_LIMIT_LOCK = Lock()
EMAIL_VERIFY_TOKEN_TYPE = "email_verify"
PASSWORD_RESET_TOKEN_TYPE = "password_reset"
MEDIA_KIND_RULES = {
    "image": {"extensions": {"png", "jpg", "jpeg", "webp", "gif"}, "mime_prefixes": ("image/",)},
    "video": {"extensions": {"mp4", "webm", "ogg", "mov", "m4v"}, "mime_prefixes": ("video/",)},
}


COURSE_BLUEPRINTS = [
    {
        "slug": "fundamentos-terran",
        "title": "Fundamentos Terran",
        "subtitle": "Documento gratuito",
        "description": "Introduccion al macro, scouting y control de recursos para mostrar el nivel del campus.",
        "level": "Inicial",
        "is_free": True,
        "price": 0,
        "rating": 4.8,
        "students": 1420,
        "locked": False,
        "tags": "Build orders,Economia,Gratis",
        "sections": [
            (1, "Vision general de Terran", "8 min"),
            (2, "Macro basica y SCV uptime", "12 min"),
            (3, "Primer scouting efectivo", "10 min"),
        ],
    },
    {
        "slug": "zerg-ladder-control",
        "title": "Zerg Ladder Control",
        "subtitle": "Curso premium",
        "description": "Ruta paga con videos, actividades variables y evaluaciones dinamicas.",
        "level": "Intermedio",
        "is_free": False,
        "price": 39,
        "rating": 4.9,
        "students": 312,
        "locked": True,
        "tags": "Premium,IA,Actividades",
        "sections": [
            (1, "Overlord paths", "11 min"),
            (2, "Inject discipline", "15 min"),
            (3, "Mid game transitions", "18 min"),
        ],
    },
    {
        "slug": "protoss-pressure",
        "title": "Protoss Pressure Systems",
        "subtitle": "Curso premium",
        "description": "Presion, control de tempo, formularios y minijuegos para medir aprendizaje.",
        "level": "Avanzado",
        "is_free": False,
        "price": 49,
        "rating": 4.7,
        "students": 204,
        "locked": True,
        "tags": "Premium,Minijuegos,Analitica",
        "sections": [
            (1, "Warp prism windows", "14 min"),
            (2, "Pressure without overcommit", "17 min"),
            (3, "Replay review method", "13 min"),
        ],
    },
]


def env_bool(key: str, default: bool = False) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(key: str, default: int) -> int:
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def resolve_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        return f"sqlite:///{DATABASE_PATH}"
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://") and "+" not in database_url.split("://", 1)[0]:
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def parse_frontend_origins() -> list[str]:
    raw_origins = os.getenv("FRONTEND_ORIGINS", "")
    if not raw_origins.strip():
        return DEFAULT_FRONTEND_ORIGINS
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def frontend_public_origin() -> str:
    return os.getenv("FRONTEND_PUBLIC_URL", "").strip() or parse_frontend_origins()[0]


def backend_public_origin() -> str:
    explicit = os.getenv("BACKEND_PUBLIC_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    return "http://127.0.0.1:5000"


def media_root() -> str:
    configured = os.getenv("MEDIA_UPLOAD_ROOT", "").strip()
    return configured or os.path.join(os.path.dirname(__file__), "instance", "uploads")


def max_upload_size_bytes() -> int:
    return max(1, env_int("MEDIA_UPLOAD_MAX_MB", 200)) * 1024 * 1024


def ensure_media_storage() -> None:
    os.makedirs(media_root(), exist_ok=True)


def media_public_url(relative_path: str) -> str:
    normalized_path = relative_path.replace("\\", "/").lstrip("/")
    return f"{backend_public_origin()}/media/{urllib.parse.quote(normalized_path, safe='/')}"


def sanitize_media_folder(folder: str) -> str:
    segments = []
    for raw_segment in str(folder or "").replace("\\", "/").split("/"):
        segment = secure_filename(raw_segment)
        if segment:
            segments.append(segment)
    return "/".join(segments)


def validate_upload_kind(kind: str) -> str:
    normalized = str(kind or "").strip().lower()
    if normalized not in MEDIA_KIND_RULES:
        raise ValueError("Upload kind must be image or video.")
    return normalized


def validate_uploaded_file(file_storage, kind: str) -> tuple[str, str]:
    filename = secure_filename(file_storage.filename or "")
    if not filename:
        raise ValueError("Select a file to upload.")

    extension = os.path.splitext(filename)[1].lower().lstrip(".")
    allowed_extensions = MEDIA_KIND_RULES[kind]["extensions"]
    if extension not in allowed_extensions:
        raise ValueError(f"Unsupported {kind} format. Allowed: {', '.join(sorted(allowed_extensions))}.")

    mimetype = (file_storage.mimetype or "").lower()
    mime_prefixes = MEDIA_KIND_RULES[kind]["mime_prefixes"]
    if mimetype and mimetype != "application/octet-stream" and not any(mimetype.startswith(prefix) for prefix in mime_prefixes):
        raise ValueError(f"Uploaded file does not look like a valid {kind}.")

    return filename, extension


def save_admin_media(file_storage, kind: str, folder: str = "") -> dict:
    normalized_kind = validate_upload_kind(kind)
    safe_name, extension = validate_uploaded_file(file_storage, normalized_kind)
    safe_folder = sanitize_media_folder(folder)

    stem = os.path.splitext(safe_name)[0][:80] or normalized_kind
    filename = f"{stem}-{secrets.token_hex(8)}.{extension}"
    relative_directory = os.path.join(normalized_kind, safe_folder) if safe_folder else normalized_kind
    target_directory = os.path.join(media_root(), relative_directory)
    os.makedirs(target_directory, exist_ok=True)

    absolute_path = os.path.join(target_directory, filename)
    file_storage.save(absolute_path)

    relative_path = os.path.relpath(absolute_path, media_root()).replace("\\", "/")
    return {
        "kind": normalized_kind,
        "filename": filename,
        "path": relative_path,
        "url": media_public_url(relative_path),
        "contentType": file_storage.mimetype or None,
        "size": os.path.getsize(absolute_path),
    }


def ensure_schema_updates() -> None:
    inspector = inspect(db.engine)
    course_columns = {column["name"] for column in inspector.get_columns("course")}
    if "image_url" not in course_columns:
        db.session.execute(text("ALTER TABLE course ADD COLUMN image_url VARCHAR(500)"))
        db.session.commit()


def payment_currency() -> str:
    raw = os.getenv("PAYMENT_CURRENCY", "USD").strip().upper()
    return raw[:3] or "USD"


def mercadopago_access_token() -> str:
    return os.getenv("MERCADOPAGO_ACCESS_TOKEN", "").strip()


def mercadopago_webhook_secret() -> str:
    return os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "").strip()


def mercadopago_api_base_url() -> str:
    return os.getenv("MERCADOPAGO_API_BASE_URL", "https://api.mercadopago.com").strip().rstrip("/")


def mercadopago_enabled() -> bool:
    return bool(mercadopago_access_token())


def mercadopago_sandbox_mode() -> bool:
    return env_bool("MERCADOPAGO_SANDBOX_MODE", True)


def mercadopago_notification_url() -> str | None:
    origin = backend_public_origin()
    if not origin.startswith("https://"):
        return None
    return f"{origin}/api/payments/webhooks/mercado-pago"


def seed_demo_users_enabled() -> bool:
    return env_bool("SEED_DEMO_USERS", True)


def demo_payments_enabled() -> bool:
    return env_bool("ENABLE_DEMO_PAYMENTS", True)


def email_verification_required() -> bool:
    return env_bool("EMAIL_VERIFICATION_REQUIRED", True)


def email_delivery_mode() -> str:
    configured = os.getenv("EMAIL_DELIVERY_MODE", "").strip().lower()
    if configured in {"smtp", "log"}:
        return configured
    return "smtp" if os.getenv("SMTP_HOST", "").strip() else "log"


def email_dev_preview_enabled() -> bool:
    return env_bool("EMAIL_DEV_PREVIEW", True)


def email_subject_prefix() -> str:
    return os.getenv("EMAIL_SUBJECT_PREFIX", "Starcraft Academy").strip() or "Starcraft Academy"


def smtp_host() -> str:
    return os.getenv("SMTP_HOST", "").strip()


def smtp_port() -> int:
    default_port = 465 if env_bool("SMTP_USE_SSL", False) else 587
    return env_int("SMTP_PORT", default_port)


def smtp_from_email() -> str:
    return os.getenv("SMTP_FROM_EMAIL", "noreply@starcraft.academy").strip() or "noreply@starcraft.academy"


def smtp_from_name() -> str:
    return os.getenv("SMTP_FROM_NAME", email_subject_prefix()).strip() or email_subject_prefix()


def email_preview_log_path() -> str:
    configured = os.getenv("EMAIL_PREVIEW_LOG_PATH", "").strip()
    return configured or os.path.join(os.path.dirname(__file__), "instance", "email_previews.log")


def verification_token_lifetime() -> timedelta:
    return timedelta(hours=max(1, env_int("EMAIL_VERIFICATION_TOKEN_HOURS", 24)))


def password_reset_token_lifetime() -> timedelta:
    return timedelta(minutes=max(5, env_int("PASSWORD_RESET_TOKEN_MINUTES", 30)))


def csrf_header_name() -> str:
    return os.getenv("CSRF_HEADER_NAME", "X-CSRF-Token").strip() or "X-CSRF-Token"


def issue_csrf_token(*, force: bool = False) -> str:
    existing = session.get("csrf_token")
    if existing and not force:
        return str(existing)
    token = secrets.token_urlsafe(32)
    session["csrf_token"] = token
    return token


def trusted_request_origins() -> set[str]:
    origins = {origin.rstrip("/") for origin in parse_frontend_origins()}
    origins.add(backend_public_origin().rstrip("/"))
    return {origin for origin in origins if origin}


def request_origin() -> str:
    origin_header = request.headers.get("Origin", "").strip()
    if origin_header:
        return origin_header.rstrip("/")
    referer_header = request.headers.get("Referer", "").strip()
    if not referer_header:
        return ""
    parsed = urllib.parse.urlsplit(referer_header)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def request_uses_https() -> bool:
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "").strip().lower()
    if forwarded_proto:
        return forwarded_proto == "https"
    return bool(request.is_secure)


def csrf_is_exempt_request() -> bool:
    if request.method.upper() in {"GET", "HEAD", "OPTIONS", "TRACE"}:
        return True
    return request.path.startswith("/api/payments/webhooks/")


def validate_csrf_request() -> tuple[str, int] | None:
    issue_csrf_token()
    if csrf_is_exempt_request():
        return None

    origin = request_origin()
    if origin and origin not in trusted_request_origins():
        return ("Invalid request origin", 403)

    provided_token = request.headers.get(csrf_header_name(), "").strip()
    expected_token = str(session.get("csrf_token") or "")
    if not provided_token:
        return ("Missing CSRF token", 403)
    if not expected_token or not hmac.compare_digest(provided_token, expected_token):
        issue_csrf_token(force=True)
        return ("Invalid CSRF token", 403)
    return None


def client_ip_address() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "unknown"
    real_ip = request.headers.get("X-Real-Ip", "").strip()
    if real_ip:
        return real_ip
    return request.remote_addr or "unknown"


def rate_limit_key(bucket: str, scope: str = "ip") -> str:
    user_id = session.get("user_id")
    if scope == "user" and user_id:
        return f"{bucket}:user:{user_id}"
    if scope == "user_or_ip" and user_id:
        return f"{bucket}:user:{user_id}"
    return f"{bucket}:ip:{client_ip_address()}"


def consume_rate_limit(bucket: str, limit: int, window_seconds: int, scope: str = "ip") -> int | None:
    if limit <= 0 or window_seconds <= 0:
        return None

    now = time.time()
    cutoff = now - window_seconds
    key = rate_limit_key(bucket, scope)

    with RATE_LIMIT_LOCK:
        timestamps = RATE_LIMIT_STATE.get(key, [])
        timestamps = [stamp for stamp in timestamps if stamp > cutoff]
        if len(timestamps) >= limit:
            RATE_LIMIT_STATE[key] = timestamps
            retry_after = max(1, int(window_seconds - (now - timestamps[0])))
            return retry_after

        timestamps.append(now)
        RATE_LIMIT_STATE[key] = timestamps

        stale_keys = [entry_key for entry_key, entry_timestamps in RATE_LIMIT_STATE.items() if not entry_timestamps or entry_timestamps[-1] <= cutoff]
        for stale_key in stale_keys[:50]:
            RATE_LIMIT_STATE.pop(stale_key, None)

    return None


def rate_limit(bucket: str, *, limit_env: str, limit_default: int, window_env: str, window_default: int, scope: str = "ip"):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            retry_after = consume_rate_limit(
                bucket,
                max(0, env_int(limit_env, limit_default)),
                max(1, env_int(window_env, window_default)),
                scope=scope,
            )
            if retry_after is None:
                return fn(*args, **kwargs)

            response = jsonify({
                "error": "Too many requests. Please wait before trying again.",
                "retryAfterSeconds": retry_after,
            })
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response

        return wrapper

    return decorator


def build_course_payment_return_url(course: Course, reference: str, status: str) -> str:
    encoded_reference = urllib.parse.quote(reference, safe="")
    return f"{frontend_public_origin().rstrip('/')}/curso/{course.slug}?payment={status}&reference={encoded_reference}"


def database_engine_name(database_url: str) -> str:
    if database_url.startswith("postgresql"):
        return "postgresql"
    if database_url.startswith("sqlite"):
        return "sqlite"
    return "unknown"


def amount_to_float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def isoformat_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def normalize_provider_label(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "Mercado Pago"
    lowered = raw.lower().replace("_", " ").replace("-", " ")
    if "mercado" in lowered:
        return "Mercado Pago"
    if "master" in lowered:
        return "Mastercard"
    if "visa" in lowered:
        return "Visa"
    return raw[:40]


def build_unique_referral_code(seed: str) -> str:
    base = re.sub(r"[^A-Z0-9]", "", seed.upper())[:8] or "CADET"
    candidate = base
    suffix = 2
    while User.query.filter_by(referral_code=candidate).first() is not None:
        suffix_text = str(suffix)
        candidate = f"{base[: max(1, 8 - len(suffix_text))]}{suffix_text}"
        suffix += 1
    return candidate


def ensure_demo_user(*, email: str, name: str, password: str, avatar: str, streak_days: int, referral_code: str, is_admin: bool) -> User:
    user = User.query.filter_by(email=email).first()
    if user is not None:
        return user

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        avatar=avatar,
        streak_days=streak_days,
        referral_code=referral_code,
        is_admin=is_admin,
    )
    db.session.add(user)
    db.session.flush()
    return user


def ensure_payment_method(user: User, brand: str, last4: str) -> PaymentMethod:
    payment_method = PaymentMethod.query.filter_by(user_id=user.id, brand=brand, last4=last4).first()
    if payment_method is not None:
        return payment_method

    payment_method = PaymentMethod(user_id=user.id, brand=brand, last4=last4)
    db.session.add(payment_method)
    db.session.flush()
    return payment_method


def ensure_bootstrap_admin() -> None:
    email = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "").strip()
    if not email or not password:
        return

    name = os.getenv("INITIAL_ADMIN_NAME", "Platform Admin").strip() or "Platform Admin"
    avatar = (os.getenv("INITIAL_ADMIN_AVATAR", "")[:8].strip() or "".join(part[0].upper() for part in name.split()[:2]) or "PA")
    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            avatar=avatar,
            streak_days=1,
            referral_code=build_unique_referral_code(name or email.split("@")[0]),
            is_admin=True,
        )
        db.session.add(user)
        db.session.flush()
        return

    if not user.is_admin:
        user.is_admin = True
    if not user.referral_code:
        user.referral_code = build_unique_referral_code(user.name or email.split("@")[0])
    if not user.avatar:
        user.avatar = avatar


def ensure_enrollment(user: User, course: Course, *, purchased: bool, progress_percent: int = 0, is_completed: bool = False) -> Enrollment:
    enrollment = Enrollment.query.filter_by(user_id=user.id, course_id=course.id).first()
    if enrollment is None:
        enrollment = Enrollment(user_id=user.id, course_id=course.id, purchased=purchased)
        db.session.add(enrollment)
        db.session.flush()

    enrollment.purchased = enrollment.purchased or purchased
    enrollment.progress_percent = max(enrollment.progress_percent, progress_percent)
    enrollment.is_completed = enrollment.is_completed or is_completed
    return enrollment


def ensure_progress(enrollment: Enrollment, section: CourseSection) -> None:
    existing = Progress.query.filter_by(enrollment_id=enrollment.id, section_id=section.id).first()
    if existing is None:
        db.session.add(Progress(enrollment_id=enrollment.id, section_id=section.id))
        db.session.flush()


def ensure_comment(user: User, course: Course, body: str, stars: int) -> None:
    existing = Comment.query.filter_by(user_id=user.id, course_id=course.id, body=body).first()
    if existing is None:
        db.session.add(Comment(user_id=user.id, course_id=course.id, body=body, stars=stars))


def ensure_support_entry(entry_type: str, body: str) -> None:
    normalized_body = body.strip()
    if not normalized_body:
        return
    existing = SupportEntry.query.filter_by(entry_type=entry_type, body=normalized_body).first()
    if existing is None:
        db.session.add(SupportEntry(entry_type=entry_type, body=normalized_body))


def slugify_course(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:120] or f"curso-{int(datetime.utcnow().timestamp())}"


def ensure_unique_course_slug(seed: str) -> str:
    base = slugify_course(seed)
    candidate = base
    suffix = 2
    while Course.query.filter_by(slug=candidate).first() is not None:
        candidate = f"{base[: max(1, 116 - len(str(suffix)))]}-{suffix}"
        suffix += 1
    return candidate


def ensure_referral(referrer: User, referred_user: User, *, status: str, reward_percent: int = 10) -> Referral:
    referral = Referral.query.filter_by(referred_user_id=referred_user.id).first()
    if referral is not None:
        return referral

    referral = Referral(
        referrer_user_id=referrer.id,
        referred_user_id=referred_user.id,
        referral_code=referrer.referral_code,
        reward_percent=reward_percent,
        status=status,
        converted_at=datetime.utcnow(),
    )
    db.session.add(referral)
    db.session.flush()
    return referral


def ensure_purchase(
    user: User,
    course: Course,
    *,
    provider_reference: str,
    payment_method: PaymentMethod | None,
    subtotal_amount: Decimal,
    discount_amount: Decimal,
    total_amount: Decimal,
    status: str = "paid",
    provider: str = "Mercado Pago",
    referral: Referral | None = None,
    currency: str | None = None,
) -> Purchase:
    purchase = Purchase.query.filter_by(provider_reference=provider_reference).first()
    if purchase is not None:
        return purchase

    purchase = Purchase(
        user_id=user.id,
        course_id=course.id,
        payment_method_id=payment_method.id if payment_method else None,
        referral_id=referral.id if referral else None,
        provider=normalize_provider_label(provider),
        provider_reference=provider_reference,
        status=status,
        currency=currency or payment_currency(),
        subtotal_amount=subtotal_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        paid_at=datetime.utcnow() if status == "paid" else None,
    )
    db.session.add(purchase)
    db.session.flush()
    return purchase


def build_section_content_seed(section: CourseSection) -> list[dict]:
    race = section.course.title.split()[0]
    first_public_preview = section.position == 1
    return [
        {
            "position": 1,
            "title": f"Documento central: {section.title}",
            "content_type": "document",
            "body": f"Guia escrita de {race} para {section.title.lower()} con pasos concretos y errores frecuentes.",
            "asset_url": None,
            "is_preview": section.course.is_free or first_public_preview,
            "estimated_minutes": 8,
            "metadata_json": {"format": "markdown", "difficulty": section.course.level.lower()},
        },
        {
            "position": 2,
            "title": f"Video breakdown: {section.title}",
            "content_type": "video",
            "body": f"Revision guiada de repeticiones enfocada en {section.title.lower()}.",
            "asset_url": f"https://assets.starcraft.academy/{section.course.slug}/{section.position}/video.mp4",
            "is_preview": False,
            "estimated_minutes": 12,
            "metadata_json": {"provider": "cdn", "resolution": "1080p", "videoRequired": True, "summary": f"Resumen accesible de {section.title.lower()} para repasar la informacion clave sin depender solo del audio."},
        },
        {
            "position": 3,
            "title": f"Actividad IA: {section.title}",
            "content_type": "activity",
            "body": f"Escenario variable para evaluar decisiones de {race} antes del minuto 5.",
            "asset_url": None,
            "is_preview": False,
            "estimated_minutes": 10,
            "metadata_json": {"generator": "guided-ai", "topic": section.title},
        },
        {
            "position": 4,
            "title": f"Quiz tactico: {section.title}",
            "content_type": "quiz",
            "body": f"Preguntas propias del staff para medir cuanto se consolido {section.title.lower()}.",
            "asset_url": None,
            "is_preview": False,
            "estimated_minutes": 6,
            "metadata_json": {"questionCount": 5, "scoring": "per-question"},
        },
    ]


def ensure_section_content(section: CourseSection) -> None:
    existing_positions = {block.position for block in section.content_blocks}
    for content_seed in build_section_content_seed(section):
        if content_seed["position"] in existing_positions:
            continue
        db.session.add(SectionContent(section_id=section.id, status="published", **content_seed))


def create_app() -> Flask:
    app = Flask(__name__)
    database_url = resolve_database_url()
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True} if database_url.startswith("postgresql") else {}
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["SESSION_COOKIE_NAME"] = os.getenv("SESSION_COOKIE_NAME", "starcraft_academy_session")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = os.getenv("SESSION_COOKIE_SAMESITE", "Lax") or "Lax"
    app.config["SESSION_COOKIE_SECURE"] = env_bool("SESSION_COOKIE_SECURE", False)
    app.config["SESSION_COOKIE_PATH"] = "/"
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=env_int("SESSION_LIFETIME_DAYS", 7))
    app.config["MAX_CONTENT_LENGTH"] = max_upload_size_bytes()
    app.config["SESSION_REFRESH_EACH_REQUEST"] = True

    cookie_domain = os.getenv("SESSION_COOKIE_DOMAIN", "").strip()
    if cookie_domain:
        app.config["SESSION_COOKIE_DOMAIN"] = cookie_domain

    db.init_app(app)
    CORS(
        app,
        supports_credentials=True,
        origins=parse_frontend_origins(),
        allow_headers=["Content-Type", csrf_header_name()],
    )

    @app.before_request
    def enforce_csrf_protection():
        validation_error = validate_csrf_request()
        if validation_error is None:
            return None
        message, status_code = validation_error
        return jsonify({"error": message, "csrfToken": issue_csrf_token(force=True)}), status_code

    @app.after_request
    def apply_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request_uses_https():
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.errorhandler(RequestEntityTooLarge)
    def handle_request_too_large(error):
        del error
        max_mb = max_upload_size_bytes() // (1024 * 1024)
        return jsonify({"error": f"File exceeds the {max_mb} MB upload limit."}), 413

    with app.app_context():
        db.create_all()
        ensure_schema_updates()
        ensure_media_storage()
        seed_data()

    register_routes(app)
    return app


def seed_data() -> None:
    if not Course.query.first():
        for blueprint in COURSE_BLUEPRINTS:
            course = Course(
                slug=blueprint["slug"],
                title=blueprint["title"],
                subtitle=blueprint["subtitle"],
                description=blueprint["description"],
                image_url=blueprint.get("image_url"),
                level=blueprint["level"],
                is_free=blueprint["is_free"],
                price=blueprint["price"],
                rating=blueprint["rating"],
                students=blueprint["students"],
                locked=blueprint["locked"],
                tags=blueprint["tags"],
            )
            db.session.add(course)
            db.session.flush()

            for position, title, duration in blueprint["sections"]:
                db.session.add(CourseSection(course_id=course.id, title=title, duration=duration, position=position))

        db.session.flush()

    courses = {course.slug: course for course in Course.query.order_by(Course.title.asc()).all()}
    for course in courses.values():
        for section in course.sections:
            ensure_section_content(section)

    for faq in DEFAULT_SUPPORT_FAQ:
        ensure_support_entry("faq", faq)
    for article in DEFAULT_SUPPORT_KNOWLEDGE:
        ensure_support_entry("knowledge", article)

    if seed_demo_users_enabled():
        admin = ensure_demo_user(
            email="sarah@starcraft.academy",
            name="Sarah Kerrigan",
            password="change-me",
            avatar="SK",
            streak_days=7,
            referral_code="ZERG10",
            is_admin=True,
        )
        raynor = ensure_demo_user(
            email="raynor@starcraft.academy",
            name="Jim Raynor",
            password="change-me",
            avatar="JR",
            streak_days=3,
            referral_code="RAYNOR",
            is_admin=False,
        )

        admin_visa = ensure_payment_method(admin, "Visa", "4242")
        ensure_payment_method(admin, "Mastercard", "1288")
        raynor_visa = ensure_payment_method(raynor, "Visa", "5454")

        terran = courses["fundamentos-terran"]
        zerg = courses["zerg-ladder-control"]
        protoss = courses["protoss-pressure"]

        admin_free = ensure_enrollment(admin, terran, purchased=True, progress_percent=100, is_completed=True)
        admin_zerg = ensure_enrollment(admin, zerg, purchased=True, progress_percent=35, is_completed=False)
        raynor_free = ensure_enrollment(raynor, terran, purchased=True, progress_percent=33, is_completed=False)
        ensure_enrollment(raynor, protoss, purchased=True, progress_percent=0, is_completed=False)

        for section in sorted(terran.sections, key=lambda item: item.position):
            ensure_progress(admin_free, section)
        first_zerg_section = sorted(zerg.sections, key=lambda item: item.position)[0]
        ensure_progress(admin_zerg, first_zerg_section)
        first_terran_section = sorted(terran.sections, key=lambda item: item.position)[0]
        ensure_progress(raynor_free, first_terran_section)

        update_enrollment_progress(admin_free)
        update_enrollment_progress(admin_zerg)
        update_enrollment_progress(raynor_free)

        referral = ensure_referral(admin, raynor, status="rewarded", reward_percent=10)
        ensure_purchase(
            admin,
            zerg,
            provider_reference="seed-admin-zerg",
            payment_method=admin_visa,
            subtotal_amount=Decimal("39.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("39.00"),
        )
        ensure_purchase(
            raynor,
            protoss,
            provider_reference="seed-raynor-protoss",
            payment_method=raynor_visa,
            subtotal_amount=Decimal("49.00"),
            discount_amount=Decimal("4.90"),
            total_amount=Decimal("44.10"),
            referral=referral,
        )

        ensure_comment(admin, terran, "La doc gratuita ya muestra bastante nivel.", 5)
        ensure_comment(admin, zerg, "Las practicas dinamicas ayudan a fijar timings.", 5)
        ensure_comment(raynor, protoss, "El curso premium deja clara la progresion por secciones.", 4)

    ensure_bootstrap_admin()
    for user in User.query.order_by(User.id.asc()).all():
        if user.email_status is None:
            ensure_email_status(user, verified=True)
    db.session.commit()


def serialize_comment(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "user": comment.user.name,
        "courseId": comment.course.slug,
        "body": comment.body,
        "stars": comment.stars,
    }


def serialize_content_block(content: SectionContent) -> dict:
    return {
        "id": content.id,
        "title": content.title,
        "type": content.content_type,
        "status": content.status,
        "body": content.body,
        "assetUrl": content.asset_url,
        "isPreview": content.is_preview,
        "estimatedMinutes": content.estimated_minutes,
        "metadata": content.metadata_json,
    }


def serialize_purchase(purchase: Purchase) -> dict:
    return {
        "id": purchase.id,
        "courseId": purchase.course.slug,
        "courseTitle": purchase.course.title,
        "provider": normalize_provider_label(purchase.provider),
        "providerReference": purchase.provider_reference,
        "status": purchase.status,
        "currency": purchase.currency,
        "subtotalAmount": amount_to_float(purchase.subtotal_amount),
        "discountAmount": amount_to_float(purchase.discount_amount),
        "totalAmount": amount_to_float(purchase.total_amount),
        "createdAt": isoformat_or_none(purchase.created_at),
        "paidAt": isoformat_or_none(purchase.paid_at),
    }


def serialize_referral(referral: Referral) -> dict:
    return {
        "id": referral.id,
        "code": referral.referral_code,
        "status": referral.status,
        "rewardPercent": referral.reward_percent,
        "referredUser": referral.referred_user.name,
        "createdAt": isoformat_or_none(referral.created_at),
        "convertedAt": isoformat_or_none(referral.converted_at),
    }


def serialize_support_content() -> dict:
    faq_entries = SupportEntry.query.filter_by(entry_type="faq").order_by(SupportEntry.created_at.asc()).all()
    knowledge_entries = SupportEntry.query.filter_by(entry_type="knowledge").order_by(SupportEntry.created_at.asc()).all()
    return {
        "faq": [entry.body for entry in faq_entries],
        "knowledge": [entry.body for entry in knowledge_entries],
    }


def tokenize_support_text(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2}


def normalize_support_token(token: str) -> str:
    normalized = token.lower()
    if normalized.endswith("es") and len(normalized) > 5:
        normalized = normalized[:-2]
    elif normalized.endswith("s") and len(normalized) > 4:
        normalized = normalized[:-1]
    return normalized


def support_tokens_match(left: str, right: str) -> bool:
    left_normalized = normalize_support_token(left)
    right_normalized = normalize_support_token(right)
    if left_normalized == right_normalized:
        return True
    shortest = min(len(left_normalized), len(right_normalized))
    if shortest >= 5 and (left_normalized in right_normalized or right_normalized in left_normalized):
        return True
    return False


def support_match_score(message_tokens: set[str], entry_tokens: set[str]) -> int:
    score = 0
    for message_token in message_tokens:
        if any(support_tokens_match(message_token, entry_token) for entry_token in entry_tokens):
            score += 1
    return score


def best_support_match(entries: list[str], tokens: set[str]) -> str | None:
    scored: list[tuple[int, int, str]] = []
    for entry in entries:
        entry_tokens = tokenize_support_text(entry)
        score = support_match_score(tokens, entry_tokens)
        if score > 0:
            scored.append((score, len(entry_tokens), entry))
    if not scored:
        return None
    scored.sort(key=lambda item: (-item[0], item[1], item[2]))
    return scored[0][2]


def support_fallback_answer(lowered: str) -> str:
    if any(keyword in lowered for keyword in {"pago", "compr", "tarjeta", "mercado"}):
        return "Puedes iniciar la compra desde la vista del curso. Si el pago entra aprobado, el curso se desbloquea para tu cuenta y queda marcado como comprado."
    if any(keyword in lowered for keyword in {"sesion", "login", "cuenta", "perfil", "cookie"}):
        return "La sesion se mantiene con cookies. Si cambias de pesta?a, el estado se revalida al volver y desde perfil puedes revisar progreso, compras y referidos."
    if any(keyword in lowered for keyword in {"curso", "seccion", "video", "actividad", "test", "juego"}):
        return "Cada curso se divide por secciones. Puede haber video obligatorio, resumen accesible, actividad guiada y test final antes de marcarlo como completado."
    if any(keyword in lowered for keyword in {"admin", "panel", "dashboard"}):
        return "Desde admin puedes crear cursos, editar soporte guiado, revisar registros, ingresos y gestionar el contenido por secciones."
    return "Puedo ayudarte con compras, progreso, cursos, soporte y acceso. Si quieres, pregunta por pagos, secciones, videos, perfil o panel admin."


def build_support_response(message: str) -> dict:
    lowered = message.strip().lower()
    support_content = serialize_support_content()
    tokens = tokenize_support_text(lowered)

    knowledge_match = best_support_match(support_content["knowledge"], tokens)
    faq_match = best_support_match(support_content["faq"], tokens)

    answer = knowledge_match or support_fallback_answer(lowered)
    if faq_match and faq_match.lower() == lowered and knowledge_match is None:
        answer = support_fallback_answer(lowered)

    suggestions = [entry for entry in support_content["faq"] if entry.strip().lower() != lowered][:3]
    if not suggestions:
        suggestions = support_content["faq"][:3]

    return {
        "answer": answer,
        "suggestions": suggestions,
    }


def parse_tag_values(raw_tags: object) -> str:
    if isinstance(raw_tags, list):
        values = [str(tag).strip() for tag in raw_tags if str(tag).strip()]
    else:
        values = [value.strip() for value in str(raw_tags or "").split(",") if value.strip()]
    return ",".join(values)


def create_course_from_admin_payload(data: dict) -> Course:
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    if not title:
        raise ValueError("Course title is required")
    if not description:
        raise ValueError("Course description is required")

    sections_payload = data.get("sections", [])
    if not isinstance(sections_payload, list) or not sections_payload:
        raise ValueError("At least one section is required")

    requested_slug = str(data.get("slug", "")).strip()
    slug = ensure_unique_course_slug(requested_slug or title)
    course = Course(
        slug=slug,
        title=title,
        subtitle=str(data.get("subtitle", "Curso premium")).strip() or "Curso premium",
        description=description,
        image_url=str(data.get("imageUrl", "")).strip() or None,
        level=str(data.get("level", "Intermedio")).strip() or "Intermedio",
        is_free=bool(data.get("isFree", False)),
        price=0 if bool(data.get("isFree", False)) else max(0, int(data.get("price", 0) or 0)),
        rating=float(data.get("rating", 4.8) or 4.8),
        students=0,
        locked=not bool(data.get("isFree", False)),
        tags=parse_tag_values(data.get("tags", [])),
    )
    db.session.add(course)
    db.session.flush()

    for index, section_data in enumerate(sections_payload, start=1):
        section_title = str(section_data.get("title", "")).strip()
        if not section_title:
            raise ValueError(f"Section {index} title is required")

        section = CourseSection(
            course_id=course.id,
            title=section_title,
            duration=str(section_data.get("duration", f"{8 + index} min")).strip() or f"{8 + index} min",
            position=index,
        )
        db.session.add(section)
        db.session.flush()

        document_body = str(section_data.get("documentBody", "")).strip() or f"Documento base para {section_title.lower()} con objetivos y errores frecuentes."
        video_url = str(section_data.get("videoUrl", "")).strip() or None
        video_summary = str(section_data.get("videoSummary", "")).strip() or f"Resumen accesible de {section_title.lower()} para repasar la clase sin depender solo del audio."
        activity_body = str(section_data.get("activityBody", "")).strip() or f"Actividad guiada para aplicar {section_title.lower()} en una partida real."
        quiz_body = str(section_data.get("quizBody", "")).strip() or f"Quiz final de la seccion {section_title.lower()} con decisiones tacticas."
        is_preview = bool(section_data.get("isPreview", course.is_free or index == 1))

        blocks = [
            SectionContent(
                section_id=section.id,
                title=f"Documento central: {section_title}",
                content_type="document",
                status="published",
                body=document_body,
                asset_url=None,
                is_preview=is_preview,
                estimated_minutes=max(4, int(section_data.get("documentMinutes", 8) or 8)),
                position=1,
                metadata_json={"format": "markdown", "difficulty": course.level.lower()},
            ),
            SectionContent(
                section_id=section.id,
                title=f"Video principal: {section_title}",
                content_type="video",
                status="published",
                body=f"Video obligatorio para {section_title.lower()}.",
                asset_url=video_url,
                is_preview=course.is_free and index == 1,
                estimated_minutes=max(4, int(section_data.get("videoMinutes", 12) or 12)),
                position=2,
                metadata_json={"videoRequired": True, "summary": video_summary, "provider": "custom"},
            ),
            SectionContent(
                section_id=section.id,
                title=f"Actividad guiada: {section_title}",
                content_type="activity",
                status="published",
                body=activity_body,
                asset_url=None,
                is_preview=False,
                estimated_minutes=max(3, int(section_data.get("activityMinutes", 10) or 10)),
                position=3,
                metadata_json={"generator": "guided-ai", "topic": section_title},
            ),
            SectionContent(
                section_id=section.id,
                title=f"Quiz tactico: {section_title}",
                content_type="quiz",
                status="published",
                body=quiz_body,
                asset_url=None,
                is_preview=False,
                estimated_minutes=max(3, int(section_data.get("quizMinutes", 6) or 6)),
                position=4,
                metadata_json={"questionCount": 5, "scoring": "per-question"},
            ),
        ]
        db.session.add_all(blocks)

    db.session.flush()
    return course


def build_activity(course: Course) -> dict:
    race = course.title.split()[0]
    return {
        "title": f"Actividad dinamica de {race}",
        "prompt": f"Analiza un escenario del curso {course.title} y explica la mejor decision antes del minuto 5.",
        "questions": [
            "Que viste en el scouting inicial?",
            "Que ajuste de build corresponde?",
            "Cual es el riesgo si reaccionas tarde?",
        ],
    }


def progress_map_for_user(user: User) -> dict[str, list[str]]:
    return {
        enrollment.course.slug: [str(progress.section_id) for progress in enrollment.progress_items]
        for enrollment in user.enrollments
    }


def build_trophies(user: User) -> list[dict]:
    trophies: list[dict] = []
    completed_courses = [enrollment for enrollment in user.enrollments if enrollment.is_completed]
    total_progress = sum(len(enrollment.progress_items) for enrollment in user.enrollments)
    rewarded_referrals = [referral for referral in user.referrals_sent if referral.status == "rewarded"]

    if user.streak_days >= 3:
        trophies.append(
            {
                "id": "streak",
                "title": f"Cadena de {user.streak_days} dias",
                "detail": "Mantuviste una racha activa de inicio de sesion.",
            }
        )
    if completed_courses:
        trophies.append(
            {
                "id": "first-course",
                "title": "Primer curso completado",
                "detail": "Terminaste al menos una ruta del campus.",
            }
        )
    if total_progress >= 3:
        trophies.append(
            {
                "id": "strategist",
                "title": "Estratega",
                "detail": "Completaste varias secciones y mantuviste el progreso.",
            }
        )
    if rewarded_referrals:
        trophies.append(
            {
                "id": "ally-builder",
                "title": "Comandante de escuadron",
                "detail": "Invitaste jugadores nuevos y activaste recompensas por referidos.",
            }
        )

    return trophies


def latest_purchase_for_user(user: User | None, course: Course, *statuses: str) -> Purchase | None:
    if user is None:
        return None
    query = Purchase.query.filter_by(user_id=user.id, course_id=course.id)
    if statuses:
        query = query.filter(Purchase.status.in_(statuses))
    return query.order_by(Purchase.created_at.desc()).first()


def paid_purchase_for_user(user: User | None, course: Course) -> Purchase | None:
    return latest_purchase_for_user(user, course, "paid")


def pending_purchase_for_user(user: User | None, course: Course) -> Purchase | None:
    return latest_purchase_for_user(user, course, "pending")


def serialize_course(course: Course, user: User | None = None) -> dict:
    enrollment = None
    if user is not None:
        enrollment = next((item for item in user.enrollments if item.course_id == course.id), None)

    paid_purchase = paid_purchase_for_user(user, course)
    is_unlocked = course.is_free or bool((enrollment and enrollment.purchased) or paid_purchase)
    completed_section_ids = [str(progress.section_id) for progress in enrollment.progress_items] if enrollment else []

    return {
        "id": course.slug,
        "slug": course.slug,
        "title": course.title,
        "subtitle": course.subtitle,
        "description": course.description,
        "imageUrl": course.image_url,
        "level": course.level,
        "isFree": course.is_free,
        "price": course.price,
        "rating": course.rating,
        "students": course.students,
        "locked": course.locked,
        "isUnlocked": is_unlocked,
        "tags": [tag for tag in course.tags.split(",") if tag],
        "sections": [
            {
                "id": str(section.id),
                "title": section.title,
                "duration": section.duration,
                "completed": str(section.id) in completed_section_ids,
                "contentBlocks": [serialize_content_block(content) for content in section.content_blocks],
            }
            for section in sorted(course.sections, key=lambda item: item.position)
        ],
        "commerce": {
            "currency": payment_currency(),
            "providers": ["Mercado Pago", "Visa", "Mastercard"],
            "latestPurchase": serialize_purchase(paid_purchase) if paid_purchase else None,
        },
    }


def serialize_profile(user: User) -> dict:
    courses = Course.query.order_by(Course.is_free.desc(), Course.title.asc()).all()
    enrolled_slug_set = {enrollment.course.slug for enrollment in user.enrollments}
    enrolled_slug_set.update(purchase.course.slug for purchase in user.purchases if purchase.status == "paid")
    enrolled_ids = [course.slug for course in courses if course.slug in enrolled_slug_set]
    completed_ids = [enrollment.course.slug for enrollment in user.enrollments if enrollment.is_completed]
    recommended_ids = [course.slug for course in courses if course.slug not in enrolled_slug_set]

    referrals = sorted(user.referrals_sent, key=lambda item: item.created_at, reverse=True)
    qualified_referrals = [referral for referral in referrals if referral.status in {"qualified", "rewarded"}]
    rewarded_referrals = [referral for referral in referrals if referral.status == "rewarded"]
    purchases = sorted(user.purchases, key=lambda item: item.created_at, reverse=True)

    return {
        "name": user.name,
        "email": user.email,
        "emailVerified": email_is_verified(user),
        "avatar": user.avatar,
        "streakDays": user.streak_days,
        "referralCode": user.referral_code,
        "enrolledCourseIds": enrolled_ids,
        "completedCourseIds": completed_ids,
        "recommendedCourseIds": recommended_ids,
        "savedCards": [f"{method.brand} terminada en {method.last4}" for method in user.payment_methods],
        "progressByCourse": progress_map_for_user(user),
        "trophies": build_trophies(user),
        "isAdmin": user.is_admin,
        "purchaseHistory": [serialize_purchase(purchase) for purchase in purchases],
        "referralSummary": {
            "sentCount": len(referrals),
            "qualifiedCount": len(qualified_referrals),
            "rewardedCount": len(rewarded_referrals),
            "discountPercent": 10,
            "recent": [serialize_referral(referral) for referral in referrals[:5]],
        },
    }


def current_user() -> User | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "Not authenticated"}), 401
        if email_verification_required() and not email_is_verified(user):
            return jsonify({"error": "Verify your email before continuing.", "verificationRequired": True, "email": user.email}), 403
        return fn(user, *args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or not user.is_admin:
            return jsonify({"error": "Admin only"}), 403
        if email_verification_required() and not email_is_verified(user):
            return jsonify({"error": "Verify your email before continuing.", "verificationRequired": True, "email": user.email}), 403
        return fn(user, *args, **kwargs)

    return wrapper


def validate_email_address(value: str) -> str:
    normalized = value.strip().lower()
    if not EMAIL_REGEX.match(normalized):
        raise ValueError("Invalid email format")
    return normalized


def ensure_email_status(user: User, *, verified: bool | None = None) -> EmailStatus:
    status = user.email_status or EmailStatus.query.filter_by(user_id=user.id).first()
    if status is None:
        status = EmailStatus(user_id=user.id, email=user.email)
        db.session.add(status)
        db.session.flush()

    if status.email != user.email:
        status.email = user.email
        if verified is None:
            status.verified_at = None

    if verified is True and status.verified_at is None:
        status.verified_at = datetime.utcnow()
    elif verified is False:
        status.verified_at = None

    return status


def email_is_verified(user: User) -> bool:
    if not email_verification_required():
        return True
    status = user.email_status or EmailStatus.query.filter_by(user_id=user.id).first()
    return bool(status and status.verified_at is not None)


def auth_token_digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def build_email_action_url(token_type: str, raw_token: str) -> str:
    route = "/verificar-email" if token_type == EMAIL_VERIFY_TOKEN_TYPE else "/restablecer-contrasena"
    encoded_token = urllib.parse.quote(raw_token, safe="")
    return f"{frontend_public_origin().rstrip('/')}{route}?token={encoded_token}"


def issue_auth_token(user: User, token_type: str, lifetime: timedelta) -> tuple[AuthToken, str]:
    AuthToken.query.filter_by(user_id=user.id, token_type=token_type, consumed_at=None).delete(synchronize_session=False)
    raw_token = secrets.token_urlsafe(32)
    token = AuthToken(
        user_id=user.id,
        token_type=token_type,
        token_digest=auth_token_digest(raw_token),
        email_snapshot=user.email,
        expires_at=datetime.utcnow() + lifetime,
    )
    db.session.add(token)
    db.session.flush()
    return token, raw_token


def lookup_auth_token(raw_token: str, token_type: str) -> AuthToken | None:
    normalized = str(raw_token or "").strip()
    if not normalized:
        return None
    token = AuthToken.query.filter_by(token_type=token_type, token_digest=auth_token_digest(normalized)).first()
    if token is None or token.consumed_at is not None or token.expires_at <= datetime.utcnow():
        return None
    return token


def consume_user_tokens(user: User, token_type: str, *, exclude_token_id: int | None = None) -> None:
    query = AuthToken.query.filter_by(user_id=user.id, token_type=token_type, consumed_at=None)
    if exclude_token_id is not None:
        query = query.filter(AuthToken.id != exclude_token_id)
    query.update({"consumed_at": datetime.utcnow()}, synchronize_session=False)


def deliver_email_message(*, recipient: str, subject: str, body: str, preview_url: str | None = None) -> dict:
    mode = email_delivery_mode()
    if mode == "smtp":
        host = smtp_host()
        if not host:
            raise RuntimeError("SMTP host is not configured")

        message = EmailMessage()
        sender_email = smtp_from_email()
        sender_name = smtp_from_name()
        message["Subject"] = subject
        message["From"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
        message["To"] = recipient
        message.set_content(body)

        username = os.getenv("SMTP_USERNAME", "").strip()
        password = os.getenv("SMTP_PASSWORD", "").strip()
        use_ssl = env_bool("SMTP_USE_SSL", False)
        use_tls = env_bool("SMTP_USE_TLS", not use_ssl)

        try:
            if use_ssl:
                with smtplib.SMTP_SSL(host, smtp_port(), timeout=20) as server:
                    if username:
                        server.login(username, password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(host, smtp_port(), timeout=20) as server:
                    server.ehlo()
                    if use_tls:
                        server.starttls()
                        server.ehlo()
                    if username:
                        server.login(username, password)
                    server.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise RuntimeError(f"Could not send email: {exc}") from exc

        return {"mode": "smtp", "sent": True, "previewUrl": None}

    log_path = email_preview_log_path()
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(f"[{datetime.utcnow().isoformat()}] TO: {recipient}\n")
        handle.write(f"SUBJECT: {subject}\n")
        handle.write(body)
        handle.write("\n" + ("-" * 72) + "\n")

    return {
        "mode": "log",
        "sent": True,
        "previewUrl": preview_url if email_dev_preview_enabled() else None,
    }


def send_verification_email(user: User) -> dict:
    status = ensure_email_status(user, verified=False)
    _token, raw_token = issue_auth_token(user, EMAIL_VERIFY_TOKEN_TYPE, verification_token_lifetime())
    status.last_verification_sent_at = datetime.utcnow()
    preview_url = build_email_action_url(EMAIL_VERIFY_TOKEN_TYPE, raw_token)
    subject = f"{email_subject_prefix()} - Verifica tu email"
    body = "\n\n".join([
        f"Hola {user.name},",
        "Tu cuenta ya fue creada. Verifica tu email para activar el login, compras y progreso sincronizado.",
        preview_url,
        "Si no pediste esta cuenta, puedes ignorar este mensaje.",
    ])
    return deliver_email_message(recipient=user.email, subject=subject, body=body, preview_url=preview_url)


def send_password_reset_email(user: User) -> dict:
    _token, raw_token = issue_auth_token(user, PASSWORD_RESET_TOKEN_TYPE, password_reset_token_lifetime())
    preview_url = build_email_action_url(PASSWORD_RESET_TOKEN_TYPE, raw_token)
    subject = f"{email_subject_prefix()} - Restablece tu contrasena"
    body = "\n\n".join([
        f"Hola {user.name},",
        "Recibimos una solicitud para restablecer tu contrasena.",
        preview_url,
        "Si no fuiste tu, ignora este mensaje y tu contrasena seguira igual.",
    ])
    return deliver_email_message(recipient=user.email, subject=subject, body=body, preview_url=preview_url)


def public_delivery_payload(delivery: dict | None) -> dict | None:
    if delivery is None:
        return None
    if email_dev_preview_enabled() or delivery.get("sent") is False:
        return delivery
    return {"mode": delivery.get("mode"), "sent": delivery.get("sent", False), "previewUrl": None}


def get_or_create_enrollment(user: User, course: Course) -> Enrollment | None:
    enrollment = Enrollment.query.filter_by(user_id=user.id, course_id=course.id).first()
    paid_purchase = paid_purchase_for_user(user, course)
    if enrollment is not None:
        if paid_purchase is not None and not enrollment.purchased:
            enrollment.purchased = True
            db.session.flush()
        return enrollment
    if not course.is_free and paid_purchase is None:
        return None

    enrollment = Enrollment(user_id=user.id, course_id=course.id, purchased=course.is_free or paid_purchase is not None)
    db.session.add(enrollment)
    db.session.flush()
    return enrollment


def update_enrollment_progress(enrollment: Enrollment) -> None:
    total_sections = len(enrollment.course.sections)
    completed_sections = Progress.query.filter_by(enrollment_id=enrollment.id).count()
    enrollment.progress_percent = 0 if total_sections == 0 else round((completed_sections / total_sections) * 100)
    enrollment.is_completed = total_sections > 0 and completed_sections >= total_sections


def parse_star_rating(raw_value: object) -> int:
    try:
        return max(1, min(5, int(raw_value)))
    except (TypeError, ValueError):
        return 5


def build_checkout_payment_method(user: User, provider_label: str, raw_last4: object) -> PaymentMethod | None:
    if provider_label == "Mercado Pago":
        return None

    digits = re.sub(r"\D", "", str(raw_last4 or ""))[-4:]
    if len(digits) != 4:
        raise ValueError("Card last4 must have 4 digits")
    return ensure_payment_method(user, provider_label, digits)


def build_purchase_amounts(course: Course, user: User) -> tuple[Decimal, Decimal, Decimal, Referral | None]:
    subtotal = Decimal(str(course.price)).quantize(Decimal("0.01"))
    discount = Decimal("0.00")
    referral = user.referral_attribution

    if referral is not None and referral.status == "qualified":
        discount = (subtotal * Decimal(referral.reward_percent) / Decimal("100")).quantize(Decimal("0.01"))
        referral.status = "rewarded"
        referral.converted_at = datetime.utcnow()
    else:
        referral = None

    total = (subtotal - discount).quantize(Decimal("0.01"))
    return subtotal, discount, total, referral


def eligible_referral_for_discount(user: User) -> Referral | None:
    referral = user.referral_attribution
    if referral is None or referral.status != "qualified":
        return None
    return referral


def calculate_checkout_amounts(course: Course, referral: Referral | None) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = Decimal(str(course.price)).quantize(Decimal("0.01"))
    discount = Decimal("0.00")
    if referral is not None:
        discount = (subtotal * Decimal(referral.reward_percent) / Decimal("100")).quantize(Decimal("0.01"))
    total = (subtotal - discount).quantize(Decimal("0.01"))
    return subtotal, discount, total


def build_purchase_reference(course: Course, user: User, prefix: str = "checkout") -> str:
    return f"{prefix}-{course.slug}-{user.id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"


def normalize_payment_status(value: object) -> str:
    raw = str(value or "pending").strip().lower()
    if raw in {"paid", "approved", "success", "succeeded"}:
        return "paid"
    if raw in {"failed", "rejected", "cancelled", "canceled", "refunded", "charged_back"}:
        return "failed"
    return "pending"


def mercadopago_payment_status(value: object) -> str:
    raw = str(value or "pending").strip().lower()
    if raw == "approved":
        return "paid"
    if raw in {"rejected", "cancelled", "canceled", "refunded", "charged_back"}:
        return "failed"
    return "pending"


def webhook_secret_is_valid() -> bool:
    expected = os.getenv("PAYMENT_WEBHOOK_SECRET", "").strip()
    if not expected:
        return True
    provided = request.headers.get("X-Webhook-Secret", "").strip()
    return provided == expected


def parse_signature_header(signature_header: str) -> tuple[str | None, str | None]:
    timestamp = None
    signature = None
    for part in signature_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "ts":
            timestamp = value
        if key == "v1":
            signature = value
    return timestamp, signature


def mercadopago_signature_is_valid() -> bool:
    secret = mercadopago_webhook_secret()
    if not secret:
        return True

    signature_header = request.headers.get("x-signature", "").strip()
    request_id = request.headers.get("x-request-id", "").strip()
    payload = request.get_json(silent=True) or {}
    data_id = request.args.get("data.id", "").strip() or str((payload.get("data") or {}).get("id", "")).strip()
    timestamp, signature = parse_signature_header(signature_header)
    if not timestamp or not signature or not request_id or not data_id:
        return False

    manifest = f"id:{data_id};request-id:{request_id};ts:{timestamp};"
    expected = hmac.new(secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def mercadopago_api_request(
    path: str,
    *,
    method: str = "GET",
    payload: dict | None = None,
    query: dict[str, object] | None = None,
) -> dict:
    access_token = mercadopago_access_token()
    if not access_token:
        raise RuntimeError("Mercado Pago access token is not configured")

    url = f"{mercadopago_api_base_url()}{path}"
    if query:
        serialized_query = urllib.parse.urlencode({key: value for key, value in query.items() if value is not None}, doseq=True)
        if serialized_query:
            url = f"{url}?{serialized_query}"

    body = None
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request_data = urllib.request.Request(url, data=body, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(request_data, timeout=20) as response:
            raw_response = response.read().decode("utf-8")
            return json.loads(raw_response) if raw_response else {}
    except urllib.error.HTTPError as exc:
        raw_error = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Mercado Pago API error ({exc.code}): {raw_error[:220]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Mercado Pago API unavailable: {exc.reason}") from exc


def mercadopago_supports_provider(provider_label: str) -> bool:
    return mercadopago_enabled() and normalize_provider_label(provider_label) in {"Mercado Pago", "Visa", "Mastercard"}


def build_mercadopago_preference(purchase: Purchase) -> dict:
    payload = {
        "items": [
            {
                "id": purchase.course.slug,
                "title": purchase.course.title,
                "description": purchase.course.subtitle,
                "quantity": 1,
                "currency_id": purchase.currency,
                "unit_price": amount_to_float(purchase.total_amount),
            }
        ],
        "payer": {
            "name": purchase.user.name,
            "email": purchase.user.email,
        },
        "external_reference": purchase.provider_reference,
        "metadata": {
            "course_slug": purchase.course.slug,
            "purchase_reference": purchase.provider_reference,
            "user_id": purchase.user_id,
        },
        "back_urls": {
            "success": build_course_payment_return_url(purchase.course, purchase.provider_reference or "", "success"),
            "failure": build_course_payment_return_url(purchase.course, purchase.provider_reference or "", "failure"),
            "pending": build_course_payment_return_url(purchase.course, purchase.provider_reference or "", "pending"),
        },
        "auto_return": "approved",
    }
    notification_url = mercadopago_notification_url()
    if notification_url is not None:
        payload["notification_url"] = notification_url
    return payload


def search_latest_mercadopago_payment(reference: str) -> dict | None:
    response = mercadopago_api_request(
        "/v1/payments/search",
        query={
            "sort": "date_created",
            "criteria": "desc",
            "range": "date_created",
            "limit": 1,
            "external_reference": reference,
        },
    )
    results = response.get("results")
    if isinstance(results, list) and results:
        first_result = results[0]
        if isinstance(first_result, dict):
            return first_result
    return None


def fetch_mercadopago_payment(payment_id: str) -> dict:
    return mercadopago_api_request(f"/v1/payments/{payment_id}")


def sync_purchase_from_payment_payload(purchase: Purchase, payment_payload: dict) -> None:
    payment_status = mercadopago_payment_status(payment_payload.get("status"))
    if purchase.status == "paid" and payment_status != "paid":
        return

    payment_method = payment_payload.get("payment_method_id") or payment_payload.get("payment_type_id") or purchase.provider
    purchase.provider = normalize_provider_label(payment_method)

    if payment_status == "paid":
        activate_paid_purchase(purchase)
        return

    purchase.status = payment_status
    if payment_status != "paid":
        purchase.paid_at = None


def sync_purchase_from_remote_provider(purchase: Purchase) -> None:
    if purchase.status == "paid" or not purchase.provider_reference:
        return
    if not mercadopago_supports_provider(purchase.provider):
        return

    payment_payload = search_latest_mercadopago_payment(purchase.provider_reference)
    if payment_payload is None:
        return
    sync_purchase_from_payment_payload(purchase, payment_payload)


def serialize_checkout_session(
    purchase: Purchase,
    *,
    redirect_url: str | None = None,
    webhook_provider: str | None = None,
) -> dict:
    provider = normalize_provider_label(purchase.provider)
    provider_slug = (webhook_provider or provider).lower().replace(" ", "-")
    reference = purchase.provider_reference or ""
    return {
        "reference": reference,
        "provider": provider,
        "status": purchase.status,
        "currency": purchase.currency,
        "amount": amount_to_float(purchase.total_amount),
        "discountAmount": amount_to_float(purchase.discount_amount),
        "sandboxMode": mercadopago_sandbox_mode() if redirect_url else True,
        "nextAction": "redirect" if redirect_url or provider == "Mercado Pago" else "confirm_card",
        "statusUrl": f"/api/payments/{reference}",
        "webhookPath": f"/api/payments/webhooks/{provider_slug}",
        "successUrl": build_course_payment_return_url(purchase.course, reference, "success"),
        "redirectUrl": redirect_url,
    }


def build_checkout_session_for_purchase(purchase: Purchase) -> dict:
    if mercadopago_supports_provider(purchase.provider):
        preference = mercadopago_api_request("/checkout/preferences", method="POST", payload=build_mercadopago_preference(purchase))
        redirect_url = preference.get("sandbox_init_point") if mercadopago_sandbox_mode() else preference.get("init_point")
        if not redirect_url:
            redirect_url = preference.get("init_point") or preference.get("sandbox_init_point")
        if not redirect_url:
            raise RuntimeError("Mercado Pago preference did not return an init_point")
        return serialize_checkout_session(purchase, redirect_url=str(redirect_url), webhook_provider="mercado-pago")
    if demo_payments_enabled():
        return serialize_checkout_session(purchase)
    raise RuntimeError("Real payment provider is not configured and demo payments are disabled")


def activate_paid_purchase(purchase: Purchase) -> None:
    was_paid = purchase.status == "paid"
    purchase.status = "paid"
    if purchase.paid_at is None:
        purchase.paid_at = datetime.utcnow()

    enrollment = Enrollment.query.filter_by(user_id=purchase.user_id, course_id=purchase.course_id).first()
    created_enrollment = False
    if enrollment is None:
        enrollment = Enrollment(user_id=purchase.user_id, course_id=purchase.course_id, purchased=True)
        db.session.add(enrollment)
        db.session.flush()
        created_enrollment = True
    else:
        enrollment.purchased = True

    if purchase.referral is not None and purchase.referral.status == "qualified":
        purchase.referral.status = "rewarded"
        purchase.referral.converted_at = datetime.utcnow()

    if created_enrollment and not was_paid:
        purchase.course.students += 1


def register_routes(app: Flask) -> None:
    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "database": database_engine_name(app.config["SQLALCHEMY_DATABASE_URI"]),
                "courses": Course.query.count(),
                "purchases": Purchase.query.count(),
                "referrals": Referral.query.count(),
                "contentBlocks": SectionContent.query.count(),
            }
        )

    @app.get("/api/courses")
    def get_courses():
        user = current_user()
        courses = Course.query.order_by(Course.is_free.desc(), Course.title.asc()).all()
        return jsonify([serialize_course(course, user) for course in courses])

    @app.get("/api/courses/<slug>")
    def get_course(slug: str):
        user = current_user()
        course = Course.query.filter_by(slug=slug).first_or_404()
        payload = serialize_course(course, user)
        payload["comments"] = [serialize_comment(comment) for comment in course.comments]
        payload["activity"] = build_activity(course)
        return jsonify(payload)

    @app.get("/api/support/content")
    def get_support_content():
        return jsonify(serialize_support_content())

    @app.post("/api/support/chat")
    @rate_limit("support-chat", limit_env="RATE_LIMIT_SUPPORT_CHAT", limit_default=18, window_env="RATE_LIMIT_SUPPORT_CHAT_WINDOW", window_default=60)
    def support_chat():
        data = request.get_json(force=True)
        message = str(data.get("message", "")).strip()
        if not message:
            return jsonify({"error": "Message is required"}), 400
        return jsonify(build_support_response(message))

    @app.get("/api/auth/csrf")
    def csrf_token():
        return jsonify({"csrfToken": issue_csrf_token()})

    @app.get("/api/auth/verify-email")
    @rate_limit("auth-verify-email", limit_env="RATE_LIMIT_AUTH_VERIFY_EMAIL", limit_default=20, window_env="RATE_LIMIT_AUTH_VERIFY_EMAIL_WINDOW", window_default=3600)
    def verify_email():
        raw_token = request.args.get("token", "").strip()
        token = lookup_auth_token(raw_token, EMAIL_VERIFY_TOKEN_TYPE)
        if token is None:
            existing_token = AuthToken.query.filter_by(token_type=EMAIL_VERIFY_TOKEN_TYPE, token_digest=auth_token_digest(raw_token)).first()
            if existing_token is None:
                return jsonify({"error": "Verification link is invalid or expired."}), 400
            user = db.session.get(User, existing_token.user_id)
            if user is None or not email_is_verified(user):
                return jsonify({"error": "Verification link is invalid or expired."}), 400
            session.clear()
            session.permanent = True
            session["user_id"] = user.id
            return jsonify({
                "profile": serialize_profile(user),
                "verified": True,
                "message": "Email already verified.",
                "csrfToken": issue_csrf_token(force=True),
            })

        user = db.session.get(User, token.user_id)
        if user is None:
            return jsonify({"error": "User not found."}), 404

        status = ensure_email_status(user, verified=True)
        status.email = user.email
        token.consumed_at = datetime.utcnow()
        consume_user_tokens(user, EMAIL_VERIFY_TOKEN_TYPE, exclude_token_id=token.id)
        db.session.commit()

        session.clear()
        session.permanent = True
        session["user_id"] = user.id
        return jsonify({
            "profile": serialize_profile(user),
            "verified": True,
            "message": "Email verified successfully.",
            "csrfToken": issue_csrf_token(force=True),
        })

    @app.post("/api/auth/register")
    @rate_limit("auth-register", limit_env="RATE_LIMIT_AUTH_REGISTER", limit_default=6, window_env="RATE_LIMIT_AUTH_REGISTER_WINDOW", window_default=600)
    def register():
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        password = data.get("password", "")
        referral_code_used = str(data.get("referralCode", "")).strip().upper() or None

        if not name:
            return jsonify({"error": "Name is required"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must have at least 6 characters"}), 400

        try:
            email = validate_email_address(data.get("email", ""))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        referrer = None
        if referral_code_used is not None:
            referrer = User.query.filter_by(referral_code=referral_code_used).first()
            if referrer is None:
                return jsonify({"error": "Referral code is invalid"}), 400

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            avatar="".join(part[0].upper() for part in name.split()[:2]) or "SC",
            streak_days=1,
            referral_code=build_unique_referral_code(name or email.split("@")[0]),
            is_admin=False,
        )
        db.session.add(user)
        db.session.flush()

        if referrer is not None and referrer.id != user.id:
            db.session.add(
                Referral(
                    referrer_user_id=referrer.id,
                    referred_user_id=user.id,
                    referral_code=referrer.referral_code,
                    reward_percent=10,
                    status="qualified",
                    converted_at=datetime.utcnow(),
                )
            )

        free_course = Course.query.filter_by(is_free=True).first()
        if free_course is not None:
            db.session.add(Enrollment(user_id=user.id, course_id=free_course.id, purchased=True))

        if email_verification_required():
            ensure_email_status(user, verified=False)
            delivery = None
            message = "Account created. Check your email to verify it before logging in."
            try:
                delivery = send_verification_email(user)
            except RuntimeError:
                delivery = {"mode": email_delivery_mode(), "sent": False, "previewUrl": None}
                message = "Account created, but we could not send the verification email yet. Use resend verification."
            db.session.commit()
            session.clear()
            return jsonify({
                "ok": True,
                "pendingVerification": True,
                "email": user.email,
                "message": message,
                "delivery": public_delivery_payload(delivery),
                "csrfToken": issue_csrf_token(force=True),
            }), 201

        ensure_email_status(user, verified=True)
        db.session.commit()
        session.clear()
        session.permanent = True
        session["user_id"] = user.id
        return jsonify({
            "profile": serialize_profile(user),
            "message": "Account created successfully.",
            "csrfToken": issue_csrf_token(force=True),
        }), 201

    @app.post("/api/auth/resend-verification")
    @rate_limit("auth-resend-verification", limit_env="RATE_LIMIT_AUTH_RESEND_VERIFICATION", limit_default=6, window_env="RATE_LIMIT_AUTH_RESEND_VERIFICATION_WINDOW", window_default=900)
    def resend_verification():
        data = request.get_json(silent=True) or {}
        raw_email = str(data.get("email", "")).strip()
        message = "If the account exists and is still pending, we sent a verification email."
        delivery = None

        try:
            email = validate_email_address(raw_email) if raw_email else ""
        except ValueError:
            email = ""

        if email:
            user = User.query.filter_by(email=email).first()
            if user is not None:
                status = ensure_email_status(user)
                if status.verified_at is None:
                    try:
                        delivery = send_verification_email(user)
                    except RuntimeError:
                        delivery = {"mode": email_delivery_mode(), "sent": False, "previewUrl": None}
                    db.session.commit()

        return jsonify({
            "ok": True,
            "message": message,
            "delivery": public_delivery_payload(delivery),
            "csrfToken": issue_csrf_token(force=True),
        })

    @app.post("/api/auth/request-password-reset")
    @rate_limit("auth-request-password-reset", limit_env="RATE_LIMIT_AUTH_PASSWORD_RESET", limit_default=6, window_env="RATE_LIMIT_AUTH_PASSWORD_RESET_WINDOW", window_default=900)
    def request_password_reset():
        data = request.get_json(silent=True) or {}
        raw_email = str(data.get("email", "")).strip()
        message = "If the account exists, we sent a password reset link."
        delivery = None

        try:
            email = validate_email_address(raw_email) if raw_email else ""
        except ValueError:
            email = ""

        if email:
            user = User.query.filter_by(email=email).first()
            if user is not None:
                try:
                    delivery = send_password_reset_email(user)
                except RuntimeError:
                    delivery = {"mode": email_delivery_mode(), "sent": False, "previewUrl": None}
                db.session.commit()

        return jsonify({
            "ok": True,
            "message": message,
            "delivery": public_delivery_payload(delivery),
            "csrfToken": issue_csrf_token(force=True),
        })

    @app.post("/api/auth/reset-password")
    @rate_limit("auth-reset-password", limit_env="RATE_LIMIT_AUTH_RESET_PASSWORD", limit_default=10, window_env="RATE_LIMIT_AUTH_RESET_PASSWORD_WINDOW", window_default=3600)
    def reset_password():
        data = request.get_json(force=True)
        raw_token = str(data.get("token", "")).strip()
        password = str(data.get("password", ""))
        if len(password) < 6:
            return jsonify({"error": "Password must have at least 6 characters"}), 400

        token = lookup_auth_token(raw_token, PASSWORD_RESET_TOKEN_TYPE)
        if token is None:
            return jsonify({"error": "Reset link is invalid or expired."}), 400

        user = db.session.get(User, token.user_id)
        if user is None:
            return jsonify({"error": "User not found."}), 404

        user.password_hash = generate_password_hash(password)
        token.consumed_at = datetime.utcnow()
        consume_user_tokens(user, PASSWORD_RESET_TOKEN_TYPE, exclude_token_id=token.id)
        db.session.commit()

        session.clear()
        return jsonify({
            "ok": True,
            "message": "Password updated. You can log in now.",
            "csrfToken": issue_csrf_token(force=True),
        })

    @app.post("/api/auth/login")
    @rate_limit("auth-login", limit_env="RATE_LIMIT_AUTH_LOGIN", limit_default=10, window_env="RATE_LIMIT_AUTH_LOGIN_WINDOW", window_default=600)
    def login():
        data = request.get_json(force=True)
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid credentials"}), 401
        if email_verification_required() and not email_is_verified(user):
            session.clear()
            return jsonify({
                "error": "Verify your email before logging in.",
                "verificationRequired": True,
                "email": user.email,
                "csrfToken": issue_csrf_token(force=True),
            }), 403

        session.clear()
        session.permanent = True
        session["user_id"] = user.id
        return jsonify({"profile": serialize_profile(user), "csrfToken": issue_csrf_token(force=True)})

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True, "csrfToken": issue_csrf_token(force=True)})

    @app.get("/api/auth/me")
    def me():
        user = current_user()
        if user is None:
            return jsonify({"profile": None, "csrfToken": issue_csrf_token()})
        return jsonify({"profile": serialize_profile(user), "csrfToken": issue_csrf_token()})

    @app.get("/api/profile")
    @login_required
    def get_profile(user: User):
        return jsonify({"profile": serialize_profile(user)})

    @app.patch("/api/profile")
    @login_required
    def update_profile(user: User):
        data = request.get_json(force=True)
        user.name = data.get("name", user.name).strip() or user.name
        user.avatar = data.get("avatar", user.avatar).strip()[:8] or user.avatar
        db.session.commit()
        return jsonify({"profile": serialize_profile(user)})

    @app.post("/api/courses/<slug>/checkout")
    @login_required
    @rate_limit("course-checkout", limit_env="RATE_LIMIT_CHECKOUT", limit_default=12, window_env="RATE_LIMIT_CHECKOUT_WINDOW", window_default=600, scope="user_or_ip")
    def create_checkout(user: User, slug: str):
        course = Course.query.filter_by(slug=slug).first_or_404()
        if course.is_free:
            return jsonify({"error": "This course is already free"}), 400

        existing_purchase = paid_purchase_for_user(user, course)
        if existing_purchase is not None:
            return jsonify({
                "course": serialize_course(course, user),
                "purchase": serialize_purchase(existing_purchase),
                "checkout": serialize_checkout_session(existing_purchase),
            })

        existing_pending = pending_purchase_for_user(user, course)
        if existing_pending is not None:
            try:
                checkout_session = build_checkout_session_for_purchase(existing_pending)
            except RuntimeError as exc:
                return jsonify({"error": str(exc)}), 502
            return jsonify({
                "course": serialize_course(course, user),
                "purchase": serialize_purchase(existing_pending),
                "checkout": checkout_session,
            })

        data = request.get_json(silent=True) or {}
        provider_label = normalize_provider_label(data.get("provider") or data.get("brand") or "Mercado Pago")

        try:
            payment_method = build_checkout_payment_method(user, provider_label, data.get("last4"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        referral = eligible_referral_for_discount(user)
        subtotal, discount, total = calculate_checkout_amounts(course, referral)
        purchase = ensure_purchase(
            user,
            course,
            provider_reference=build_purchase_reference(course, user, "checkout"),
            payment_method=payment_method,
            subtotal_amount=subtotal,
            discount_amount=discount,
            total_amount=total,
            status="pending",
            provider=provider_label,
            referral=referral,
        )
        db.session.commit()
        try:
            checkout_session = build_checkout_session_for_purchase(purchase)
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 502
        return jsonify({
            "course": serialize_course(course, user),
            "purchase": serialize_purchase(purchase),
            "checkout": checkout_session,
        }), 201

    @app.get("/api/payments/<reference>")
    @login_required
    def get_payment_status(user: User, reference: str):
        purchase = Purchase.query.filter_by(provider_reference=reference, user_id=user.id).first()
        if purchase is None:
            return jsonify({"error": "Purchase not found"}), 404

        try:
            sync_purchase_from_remote_provider(purchase)
            db.session.commit()
        except RuntimeError:
            db.session.rollback()

        return jsonify({
            "purchase": serialize_purchase(purchase),
            "course": serialize_course(purchase.course, user),
            "checkout": serialize_checkout_session(purchase),
        })

    @app.post("/api/payments/<reference>/confirm-demo")
    @login_required
    @rate_limit("payment-confirm-demo", limit_env="RATE_LIMIT_DEMO_CONFIRM", limit_default=20, window_env="RATE_LIMIT_DEMO_CONFIRM_WINDOW", window_default=300, scope="user_or_ip")
    def confirm_demo_payment(user: User, reference: str):
        if not demo_payments_enabled():
            return jsonify({"error": "Demo payments are disabled"}), 404

        purchase = Purchase.query.filter_by(provider_reference=reference, user_id=user.id).first()
        if purchase is None:
            return jsonify({"error": "Purchase not found"}), 404

        activate_paid_purchase(purchase)
        db.session.commit()
        return jsonify({
            "profile": serialize_profile(user),
            "purchase": serialize_purchase(purchase),
            "course": serialize_course(purchase.course, user),
            "checkout": serialize_checkout_session(purchase),
        })

    @app.post("/api/payments/webhooks/<provider>")
    def payment_webhook(provider: str):
        normalized_provider = normalize_provider_label(provider)
        data = request.get_json(silent=True) or {}

        if normalized_provider == "Mercado Pago":
            if not mercadopago_signature_is_valid():
                return jsonify({"error": "Invalid Mercado Pago webhook signature"}), 403

            payment_id = request.args.get("data.id", "").strip() or str((data.get("data") or {}).get("id", "")).strip() or str(data.get("id", "")).strip()
            if not payment_id:
                return jsonify({"ok": True, "ignored": "missing payment id"}), 202

            try:
                payment_payload = fetch_mercadopago_payment(payment_id)
            except RuntimeError as exc:
                return jsonify({"error": str(exc)}), 502

            reference = str(payment_payload.get("external_reference") or "").strip()
            if not reference:
                return jsonify({"ok": True, "ignored": "missing external_reference"}), 202

            purchase = Purchase.query.filter_by(provider_reference=reference).first()
            if purchase is None:
                return jsonify({"error": "Purchase not found"}), 404

            sync_purchase_from_payment_payload(purchase, payment_payload)
            db.session.commit()
            return jsonify({
                "ok": True,
                "purchase": serialize_purchase(purchase),
                "course": serialize_course(purchase.course, purchase.user),
                "checkout": serialize_checkout_session(purchase),
            })

        if not webhook_secret_is_valid():
            return jsonify({"error": "Invalid webhook secret"}), 403

        reference = str(data.get("reference") or data.get("providerReference") or "").strip()
        if not reference:
            return jsonify({"error": "Payment reference is required"}), 400

        purchase = Purchase.query.filter_by(provider_reference=reference).first()
        if purchase is None:
            return jsonify({"error": "Purchase not found"}), 404

        purchase.provider = normalized_provider
        status = normalize_payment_status(data.get("status"))

        if status == "paid":
            activate_paid_purchase(purchase)
        else:
            purchase.status = status
            if status != "paid":
                purchase.paid_at = None

        db.session.commit()
        return jsonify({
            "ok": True,
            "purchase": serialize_purchase(purchase),
            "course": serialize_course(purchase.course, purchase.user),
            "checkout": serialize_checkout_session(purchase),
        })

    @app.post("/api/courses/<slug>/purchase")
    @login_required
    @rate_limit("course-purchase-demo", limit_env="RATE_LIMIT_PURCHASE", limit_default=8, window_env="RATE_LIMIT_PURCHASE_WINDOW", window_default=600, scope="user_or_ip")
    def purchase_course(user: User, slug: str):
        if not demo_payments_enabled():
            return jsonify({"error": "Demo payments are disabled"}), 404

        course = Course.query.filter_by(slug=slug).first_or_404()
        if course.is_free:
            enrollment = get_or_create_enrollment(user, course)
            if enrollment is not None:
                db.session.commit()
            return jsonify({"profile": serialize_profile(user), "course": serialize_course(course, user), "purchase": None})

        existing_purchase = paid_purchase_for_user(user, course)
        if existing_purchase is not None:
            enrollment = get_or_create_enrollment(user, course)
            if enrollment is not None and not enrollment.purchased:
                enrollment.purchased = True
                db.session.commit()
            return jsonify({"profile": serialize_profile(user), "course": serialize_course(course, user), "purchase": serialize_purchase(existing_purchase)})

        data = request.get_json(silent=True) or {}
        provider_label = normalize_provider_label(data.get("provider") or data.get("brand") or "Mercado Pago")

        try:
            payment_method = build_checkout_payment_method(user, provider_label, data.get("last4"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        subtotal, discount, total, referral = build_purchase_amounts(course, user)
        purchase = ensure_purchase(
            user,
            course,
            provider_reference=build_purchase_reference(course, user, "instant"),
            payment_method=payment_method,
            subtotal_amount=subtotal,
            discount_amount=discount,
            total_amount=total,
            status="pending",
            provider=provider_label,
            referral=referral,
        )
        activate_paid_purchase(purchase)

        db.session.commit()
        return jsonify({"profile": serialize_profile(user), "course": serialize_course(course, user), "purchase": serialize_purchase(purchase)}), 201

    @app.post("/api/courses/<slug>/progress")
    @login_required
    @rate_limit("course-progress", limit_env="RATE_LIMIT_PROGRESS", limit_default=80, window_env="RATE_LIMIT_PROGRESS_WINDOW", window_default=300, scope="user_or_ip")
    def complete_section(user: User, slug: str):
        data = request.get_json(force=True)
        section_id = str(data.get("sectionId", "")).strip()
        if not section_id:
            return jsonify({"error": "Section id is required"}), 400

        course = Course.query.filter_by(slug=slug).first_or_404()
        enrollment = get_or_create_enrollment(user, course)
        if enrollment is None or (not course.is_free and not enrollment.purchased):
            return jsonify({"error": "Course is locked for this user"}), 403

        section = CourseSection.query.filter_by(id=section_id, course_id=course.id).first()
        if section is None:
            return jsonify({"error": "Section does not belong to this course"}), 400

        existing = Progress.query.filter_by(enrollment_id=enrollment.id, section_id=section.id).first()
        if existing is None:
            db.session.add(Progress(enrollment_id=enrollment.id, section_id=section.id))
            db.session.flush()

        update_enrollment_progress(enrollment)
        db.session.commit()
        return jsonify({"profile": serialize_profile(user)})

    @app.get("/media/<path:relative_path>")
    def media_file(relative_path: str):
        normalized_path = relative_path.strip().replace("\\", "/").lstrip("/")
        if not normalized_path:
            return jsonify({"error": "Media file not found"}), 404
        return send_from_directory(media_root(), normalized_path)

    @app.post("/api/admin/uploads")
    @admin_required
    @rate_limit("admin-upload-media", limit_env="RATE_LIMIT_ADMIN_WRITE", limit_default=30, window_env="RATE_LIMIT_ADMIN_WRITE_WINDOW", window_default=600, scope="user_or_ip")
    def admin_upload_media(user: User):
        del user
        upload = request.files.get("file")
        if upload is None:
            return jsonify({"error": "File is required."}), 400

        kind = str(request.form.get("kind", "")).strip()
        folder = str(request.form.get("folder", "")).strip()
        try:
            payload = save_admin_media(upload, kind, folder)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        return jsonify(payload), 201

    @app.post("/api/admin/courses")
    @admin_required
    @rate_limit("admin-create-course", limit_env="RATE_LIMIT_ADMIN_WRITE", limit_default=30, window_env="RATE_LIMIT_ADMIN_WRITE_WINDOW", window_default=600, scope="user_or_ip")
    def admin_create_course(user: User):
        data = request.get_json(force=True)
        try:
            course = create_course_from_admin_payload(data)
        except ValueError as exc:
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400

        db.session.commit()
        payload = serialize_course(course, user)
        payload["comments"] = []
        payload["activity"] = build_activity(course)
        return jsonify({"course": payload}), 201

    @app.put("/api/admin/support")
    @admin_required
    @rate_limit("admin-save-support", limit_env="RATE_LIMIT_ADMIN_WRITE", limit_default=30, window_env="RATE_LIMIT_ADMIN_WRITE_WINDOW", window_default=600, scope="user_or_ip")
    def admin_save_support(user: User):
        data = request.get_json(force=True)
        faq_items = [str(item).strip() for item in data.get("faq", []) if str(item).strip()]
        knowledge_items = [str(item).strip() for item in data.get("knowledge", []) if str(item).strip()]

        SupportEntry.query.delete()
        db.session.flush()

        for item in faq_items:
            db.session.add(SupportEntry(entry_type="faq", body=item))
        for item in knowledge_items:
            db.session.add(SupportEntry(entry_type="knowledge", body=item))

        db.session.commit()
        return jsonify(serialize_support_content())

    @app.get("/api/admin/stats")
    @admin_required
    def admin_stats(user: User):
        paid_purchases = Purchase.query.filter_by(status="paid").all()
        revenue = sum((purchase.total_amount for purchase in paid_purchases), Decimal("0.00"))
        premium_enrollments = Enrollment.query.filter_by(purchased=True).join(Course).filter(Course.is_free.is_(False)).count()
        return jsonify(
            {
                "registeredUsers": User.query.count(),
                "activeUsers": db.session.query(Enrollment.user_id).distinct().count(),
                "guests": 326,
                "monthlyRevenue": amount_to_float(revenue),
                "premiumEnrollments": premium_enrollments,
                "paidPurchases": len(paid_purchases),
                "trackedReferrals": Referral.query.count(),
                "contentBlocks": SectionContent.query.count(),
                "database": database_engine_name(app.config["SQLALCHEMY_DATABASE_URI"]),
            }
        )

    @app.post("/api/activities/generate")
    @rate_limit("activities-generate", limit_env="RATE_LIMIT_ACTIVITY_GENERATION", limit_default=24, window_env="RATE_LIMIT_ACTIVITY_GENERATION_WINDOW", window_default=300)
    def generate_activity():
        data = request.get_json(force=True)
        topic = data.get("topic", "macro discipline")
        race = data.get("race", "Terran")
        return jsonify(
            {
                "title": f"Actividad dinamica de {race}",
                "prompt": f"Analiza un escenario de {topic} y explica la mejor decision antes del minuto 5.",
                "questions": [
                    "Que viste en el scouting inicial?",
                    "Que ajuste de build corresponde?",
                    "Cual es el riesgo si reaccionas tarde?",
                ],
            }
        )

    @app.post("/api/courses/<slug>/comments")
    @login_required
    @rate_limit("course-comments", limit_env="RATE_LIMIT_COMMENTS", limit_default=12, window_env="RATE_LIMIT_COMMENTS_WINDOW", window_default=300, scope="user_or_ip")
    def add_comment(user: User, slug: str):
        course = Course.query.filter_by(slug=slug).first_or_404()
        enrollment = get_or_create_enrollment(user, course)
        if enrollment is None or (not course.is_free and not enrollment.purchased):
            return jsonify({"error": "Course is locked for this user"}), 403

        data = request.get_json(force=True)
        body = data.get("body", "").strip()
        if not body:
            return jsonify({"error": "Comment body is required"}), 400

        comment = Comment(
            user_id=user.id,
            course_id=course.id,
            body=body,
            stars=parse_star_rating(data.get("stars", 5)),
        )
        db.session.add(comment)
        db.session.commit()
        return jsonify({"comment": serialize_comment(comment)}), 201


app = create_app()


if __name__ == "__main__":
    app.run(port=5000, debug=env_bool("FLASK_DEBUG", False))


