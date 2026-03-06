from __future__ import annotations

import os
import re
from datetime import datetime
from decimal import Decimal
from functools import wraps

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from models import Comment, Course, CourseSection, Enrollment, PaymentMethod, Progress, Purchase, Referral, SectionContent, User, db


DATABASE_PATH = os.path.join(os.path.dirname(__file__), "academy.db")
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
DEFAULT_FRONTEND_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]


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
    provider: str = "mercado_pago",
    referral: Referral | None = None,
) -> Purchase:
    purchase = Purchase.query.filter_by(provider_reference=provider_reference).first()
    if purchase is not None:
        return purchase

    purchase = Purchase(
        user_id=user.id,
        course_id=course.id,
        payment_method_id=payment_method.id if payment_method else None,
        referral_id=referral.id if referral else None,
        provider=provider,
        provider_reference=provider_reference,
        status=status,
        currency="USD",
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
            "metadata_json": {"provider": "cdn", "resolution": "1080p"},
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
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

    db.init_app(app)
    CORS(app, supports_credentials=True, origins=parse_frontend_origins())

    with app.app_context():
        db.create_all()
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
        "provider": purchase.provider,
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


def paid_purchase_for_user(user: User | None, course: Course) -> Purchase | None:
    if user is None:
        return None
    return (
        Purchase.query.filter_by(user_id=user.id, course_id=course.id, status="paid")
        .order_by(Purchase.created_at.desc())
        .first()
    )


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
            "currency": "USD",
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
        return fn(user, *args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or not user.is_admin:
            return jsonify({"error": "Admin only"}), 403
        return fn(user, *args, **kwargs)

    return wrapper


def validate_email_address(value: str) -> str:
    normalized = value.strip().lower()
    if not EMAIL_REGEX.match(normalized):
        raise ValueError("Invalid email format")
    return normalized


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

    @app.post("/api/auth/register")
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

        db.session.commit()
        session["user_id"] = user.id
        return jsonify({"profile": serialize_profile(user)}), 201

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid credentials"}), 401

        session["user_id"] = user.id
        return jsonify({"profile": serialize_profile(user)})

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True})

    @app.get("/api/auth/me")
    def me():
        user = current_user()
        if user is None:
            return jsonify({"profile": None})
        return jsonify({"profile": serialize_profile(user)})

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

    @app.post("/api/courses/<slug>/progress")
    @login_required
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
    app.run(port=5000, debug=True)


