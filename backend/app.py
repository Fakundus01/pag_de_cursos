from __future__ import annotations

import os
import re
from functools import wraps

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from models import Comment, Course, CourseSection, Enrollment, PaymentMethod, Progress, User, db


DATABASE_PATH = os.path.join(os.path.dirname(__file__), "academy.db")
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH}")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5173", "http://localhost:5173"])

    with app.app_context():
        db.create_all()
        seed_data()

    register_routes(app)
    return app


def seed_data() -> None:
    if Course.query.first():
        return

    terran = Course(
        slug="fundamentos-terran",
        title="Fundamentos Terran",
        subtitle="Documento gratuito",
        description="Introduccion al macro, scouting y control de recursos para mostrar el nivel del campus.",
        level="Inicial",
        is_free=True,
        price=0,
        rating=4.8,
        students=1420,
        locked=False,
        tags="Build orders,Economia,Gratis"
    )
    zerg = Course(
        slug="zerg-ladder-control",
        title="Zerg Ladder Control",
        subtitle="Curso premium",
        description="Ruta paga con videos, actividades variables y evaluaciones dinamicas.",
        level="Intermedio",
        is_free=False,
        price=39,
        rating=4.9,
        students=312,
        locked=True,
        tags="Premium,IA,Actividades"
    )
    protoss = Course(
        slug="protoss-pressure",
        title="Protoss Pressure Systems",
        subtitle="Curso premium",
        description="Presion, control de tempo, formularios y minijuegos para medir aprendizaje.",
        level="Avanzado",
        is_free=False,
        price=49,
        rating=4.7,
        students=204,
        locked=True,
        tags="Premium,Minijuegos,Analitica"
    )
    db.session.add_all([terran, zerg, protoss])
    db.session.flush()

    sections = [
        CourseSection(course_id=terran.id, title="Vision general de Terran", duration="8 min", position=1),
        CourseSection(course_id=terran.id, title="Macro basica y SCV uptime", duration="12 min", position=2),
        CourseSection(course_id=terran.id, title="Primer scouting efectivo", duration="10 min", position=3),
        CourseSection(course_id=zerg.id, title="Overlord paths", duration="11 min", position=1),
        CourseSection(course_id=zerg.id, title="Inject discipline", duration="15 min", position=2),
        CourseSection(course_id=zerg.id, title="Mid game transitions", duration="18 min", position=3),
        CourseSection(course_id=protoss.id, title="Warp prism windows", duration="14 min", position=1),
        CourseSection(course_id=protoss.id, title="Pressure without overcommit", duration="17 min", position=2),
        CourseSection(course_id=protoss.id, title="Replay review method", duration="13 min", position=3)
    ]
    db.session.add_all(sections)

    admin = User(
        name="Sarah Kerrigan",
        email="sarah@starcraft.academy",
        password_hash=generate_password_hash("change-me"),
        avatar="SK",
        streak_days=7,
        referral_code="ZERG-10",
        is_admin=True
    )
    db.session.add(admin)
    db.session.flush()

    enrollments = [
        Enrollment(user_id=admin.id, course_id=terran.id, progress_percent=100, is_completed=True, purchased=True),
        Enrollment(user_id=admin.id, course_id=zerg.id, progress_percent=35, is_completed=False, purchased=True)
    ]
    db.session.add_all(enrollments)
    db.session.flush()

    terran_sections = CourseSection.query.filter_by(course_id=terran.id).all()
    for section in terran_sections:
        db.session.add(Progress(enrollment_id=enrollments[0].id, section_id=section.id))

    db.session.add_all([
        PaymentMethod(user_id=admin.id, brand="Visa", last4="4242"),
        PaymentMethod(user_id=admin.id, brand="Mastercard", last4="1288"),
        Comment(user_id=admin.id, course_id=terran.id, body="La doc gratuita ya muestra bastante nivel.", stars=5),
        Comment(user_id=admin.id, course_id=zerg.id, body="Las practicas dinamicas ayudan a fijar timings.", stars=5)
    ])
    db.session.commit()


def serialize_course(course: Course) -> dict:
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
        "tags": [tag for tag in course.tags.split(",") if tag],
        "sections": [
            {
                "id": str(section.id),
                "title": section.title,
                "duration": section.duration,
            }
            for section in sorted(course.sections, key=lambda item: item.position)
        ]
    }


def serialize_profile(user: User) -> dict:
    return {
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar,
        "streakDays": user.streak_days,
        "referralCode": user.referral_code,
        "enrolledCourseIds": [enrollment.course.slug for enrollment in user.enrollments],
        "completedCourseIds": [enrollment.course.slug for enrollment in user.enrollments if enrollment.is_completed],
        "savedCards": [f"{method.brand} terminada en {method.last4}" for method in user.payment_methods],
        "isAdmin": user.is_admin,
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


def register_routes(app: Flask) -> None:
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/api/courses")
    def get_courses():
        courses = Course.query.order_by(Course.is_free.desc(), Course.title.asc()).all()
        return jsonify([serialize_course(course) for course in courses])

    @app.get("/api/courses/<slug>")
    def get_course(slug: str):
        course = Course.query.filter_by(slug=slug).first_or_404()
        payload = serialize_course(course)
        payload["comments"] = [
            {"user": comment.user.name, "body": comment.body, "stars": comment.stars}
            for comment in course.comments
        ]
        return jsonify(payload)

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        password = data.get("password", "")
        referral_code = data.get("referralCode")

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

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            avatar="".join(part[0].upper() for part in name.split()[:2]) or "SC",
            streak_days=1,
            referral_code=referral_code or email.split("@")[0].upper()[:8],
            is_admin=False,
        )
        db.session.add(user)
        db.session.flush()

        free_course = Course.query.filter_by(is_free=True).first()
        if free_course:
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
        if not user:
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
        user.avatar = data.get("avatar", user.avatar).strip() or user.avatar
        db.session.commit()
        return jsonify({"profile": serialize_profile(user)})

    @app.get("/api/admin/stats")
    @admin_required
    def admin_stats(user: User):
        revenue = sum(course.price for course in Course.query.filter_by(is_free=False).all() for enrollment in course.enrollments if enrollment.purchased)
        premium_enrollments = Enrollment.query.filter_by(purchased=True).join(Course).filter(Course.is_free.is_(False)).count()
        return jsonify(
            {
                "registeredUsers": User.query.count(),
                "activeUsers": Enrollment.query.distinct(Enrollment.user_id).count(),
                "guests": 326,
                "monthlyRevenue": revenue,
                "premiumEnrollments": premium_enrollments,
            }
        )

    @app.post("/api/activities/generate")
    def generate_activity():
        data = request.get_json(force=True)
        race = data.get("race", "Terran")
        topic = data.get("topic", "macro discipline")
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
        data = request.get_json(force=True)
        body = data.get("body", "").strip()
        if not body:
            return jsonify({"error": "Comment body is required"}), 400
        comment = Comment(
            user_id=user.id,
            course_id=course.id,
            body=body,
            stars=max(1, min(5, int(data.get("stars", 5)))),
        )
        db.session.add(comment)
        db.session.commit()
        return jsonify({"ok": True}), 201


app = create_app()


if __name__ == "__main__":
    app.run(port=5000, debug=True)
