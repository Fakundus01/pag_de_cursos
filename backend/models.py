from __future__ import annotations

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData


metadata = MetaData(
    naming_convention={
        "ix": "ix_%(table_name)s_%(column_0_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)

db = SQLAlchemy(metadata=metadata)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(8), default="SC")
    streak_days = db.Column(db.Integer, default=1)
    referral_code = db.Column(db.String(32), nullable=False, unique=True)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    enrollments = db.relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    payment_methods = db.relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")
    purchases = db.relationship("Purchase", back_populates="user", cascade="all, delete-orphan")
    email_status = db.relationship("EmailStatus", back_populates="user", uselist=False, cascade="all, delete-orphan")
    auth_tokens = db.relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")
    referrals_sent = db.relationship(
        "Referral",
        foreign_keys="Referral.referrer_user_id",
        back_populates="referrer",
        cascade="all, delete-orphan",
    )
    referral_attribution = db.relationship(
        "Referral",
        foreign_keys="Referral.referred_user_id",
        back_populates="referred_user",
        uselist=False,
    )


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(120), nullable=False, unique=True)
    title = db.Column(db.String(160), nullable=False)
    subtitle = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(500), nullable=True)
    level = db.Column(db.String(40), nullable=False)
    is_free = db.Column(db.Boolean, default=False)
    price = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=4.5)
    students = db.Column(db.Integer, default=0)
    locked = db.Column(db.Boolean, default=True)
    tags = db.Column(db.String(255), default="")

    sections = db.relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="course", cascade="all, delete-orphan")
    enrollments = db.relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    purchases = db.relationship("Purchase", back_populates="course", cascade="all, delete-orphan")


class CourseSection(db.Model):
    __table_args__ = (db.UniqueConstraint("course_id", "position"),)

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    duration = db.Column(db.String(24), nullable=False)
    position = db.Column(db.Integer, nullable=False)

    course = db.relationship("Course", back_populates="sections")
    progress_items = db.relationship("Progress", back_populates="section", cascade="all, delete-orphan")
    content_blocks = db.relationship(
        "SectionContent",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="SectionContent.position",
    )


class Enrollment(db.Model):
    __table_args__ = (db.UniqueConstraint("user_id", "course_id"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    progress_percent = db.Column(db.Integer, default=0)
    is_completed = db.Column(db.Boolean, default=False)
    purchased = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="enrollments")
    course = db.relationship("Course", back_populates="enrollments")
    progress_items = db.relationship("Progress", back_populates="enrollment", cascade="all, delete-orphan")


class Progress(db.Model):
    __table_args__ = (db.UniqueConstraint("enrollment_id", "section_id"),)

    id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.Integer, db.ForeignKey("enrollment.id"), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey("course_section.id"), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    enrollment = db.relationship("Enrollment", back_populates="progress_items")
    section = db.relationship("CourseSection", back_populates="progress_items")


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    stars = db.Column(db.Integer, default=5)

    user = db.relationship("User", back_populates="comments")
    course = db.relationship("Course", back_populates="comments")


class PaymentMethod(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    brand = db.Column(db.String(40), nullable=False)
    last4 = db.Column(db.String(4), nullable=False)

    user = db.relationship("User", back_populates="payment_methods")
    purchases = db.relationship("Purchase", back_populates="payment_method")


class Referral(db.Model):
    __table_args__ = (db.UniqueConstraint("referred_user_id"),)

    id = db.Column(db.Integer, primary_key=True)
    referrer_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    referred_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    referral_code = db.Column(db.String(32), nullable=False)
    reward_percent = db.Column(db.Integer, default=10)
    status = db.Column(db.String(20), nullable=False, default="qualified")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    converted_at = db.Column(db.DateTime, nullable=True)

    referrer = db.relationship("User", foreign_keys=[referrer_user_id], back_populates="referrals_sent")
    referred_user = db.relationship("User", foreign_keys=[referred_user_id], back_populates="referral_attribution")
    purchases = db.relationship("Purchase", back_populates="referral")


class Purchase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    payment_method_id = db.Column(db.Integer, db.ForeignKey("payment_method.id"), nullable=True)
    referral_id = db.Column(db.Integer, db.ForeignKey("referral.id"), nullable=True)
    provider = db.Column(db.String(40), nullable=False, default="mercado_pago")
    provider_reference = db.Column(db.String(120), nullable=True, unique=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    currency = db.Column(db.String(3), nullable=False, default="USD")
    subtotal_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    discount_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    paid_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", back_populates="purchases")
    course = db.relationship("Course", back_populates="purchases")
    payment_method = db.relationship("PaymentMethod", back_populates="purchases")
    referral = db.relationship("Referral", back_populates="purchases")


class SectionContent(db.Model):
    __table_args__ = (db.UniqueConstraint("section_id", "position"),)

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("course_section.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    content_type = db.Column(db.String(20), nullable=False, default="document")
    status = db.Column(db.String(20), nullable=False, default="published")
    body = db.Column(db.Text, nullable=False, default="")
    asset_url = db.Column(db.String(500), nullable=True)
    is_preview = db.Column(db.Boolean, default=False)
    estimated_minutes = db.Column(db.Integer, default=0)
    position = db.Column(db.Integer, nullable=False)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    section = db.relationship("CourseSection", back_populates="content_blocks")


class EmailStatus(db.Model):
    __table_args__ = (db.UniqueConstraint("user_id"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    last_verification_sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", back_populates="email_status")


class AuthToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    token_type = db.Column(db.String(32), nullable=False)
    token_digest = db.Column(db.String(64), nullable=False, unique=True)
    email_snapshot = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    consumed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", back_populates="auth_tokens")


class SupportEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    entry_type = db.Column(db.String(20), nullable=False, default="faq")
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
