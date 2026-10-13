import os
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import jwt
import bcrypt
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# Tự động nạp biến môi trường từ file .env nếu có
load_dotenv()

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "smartstudy.db")

# Bắt buộc đọc JWT_SECRET từ biến môi trường để chống giả mạo token
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET or not JWT_SECRET.strip():
    raise ValueError(
        "LỖI BẢO MẬT: Biến môi trường 'JWT_SECRET' chưa được thiết lập! "
        "Vui lòng khai báo 'JWT_SECRET' trong file .env hoặc biến môi trường hệ thống trước khi khởi động ứng dụng."
    )

JWT_ALGORITHM = "HS256"
ALLOW_DEV_OTP_HINT = os.getenv("ALLOW_DEV_OTP_HINT", "true").lower() == "true"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # 1. Bảng người dùng
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT DEFAULT '🐱',
        email_verified INTEGER DEFAULT 0,
        role TEXT DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Bảng OTP xác thực
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        type TEXT NOT NULL, -- 'verify-email' hoặc 'reset-password'
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Bảng lịch sử thi Quiz của từng học viên
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        document_source TEXT NOT NULL,
        score_10 REAL NOT NULL,
        correct_count INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)

    # 4. Bảng liên kết tài liệu theo người dùng (học viên nạp vào balo của riêng mình)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        source_name TEXT NOT NULL,
        total_pages INTEGER DEFAULT 0,
        chunks_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)
    conn.commit()
    conn.close()
    logger.info("[AuthService] Đã khởi tạo cơ sở dữ liệu SQLite: %s", DB_PATH)

# Chạy tạo bảng ngay khi import
init_db()

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_jwt_token(user_id: int, email: str, full_name: str, avatar: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "full_name": full_name,
        "avatar": avatar,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_sub": False})
    except Exception as e:
        logger.error(f"[AuthService] JWT decode error: {e}")
        return None

def send_otp_email(to_email: str, otp_code: str, action_name: str = "Xác minh tài khoản"):
    """Gửi email chứa mã OTP. Nếu chưa cấu hình SMTP, in ra console backend để người dùng test."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    mail_from = os.getenv("MAIL_FROM", f'"SmartStudy EdTech" <{smtp_user or "noreply@smartstudy.edu.vn"}>')

    if not smtp_user or not smtp_pass:
        logger.info(f"⚡ [DEV OTP HINT] Mã OTP của {to_email} cho '{action_name}' là: >>> {otp_code} <<< (Chưa điền SMTP_PASS)")
        return {
            "sent": False,
            "dev_hint": otp_code if ALLOW_DEV_OTP_HINT else None,
            "message": "Đang chạy chế độ nội bộ. Hãy kiểm tra console backend để lấy mã OTP hoặc điền SMTP_PASS vào .env!"
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{action_name}] Mã OTP của bạn: {otp_code}"
        msg["From"] = mail_from
        msg["To"] = to_email

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border-radius: 16px; border: 1px solid #bae6fd; background-color: #f0f7ff;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #0284c7; margin: 0;">SmartStudy EdTech 🌟</h2>
                <p style="color: #64748b; font-size: 13px; margin: 5px 0 0;">Bạn cùng tiến học tập 4.0</p>
            </div>
            <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.08);">
                <p style="font-size: 14px; color: #1e293b; margin-bottom: 15px;">Mã xác thực <strong>{action_name}</strong> của bạn là:</p>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0284c7; padding: 12px 20px; background: #e0f2fe; border-radius: 10px; display: inline-block; font-family: monospace;">
                    {otp_code}
                </div>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 15px;">Mã có hiệu lực trong vòng 10 phút. Không chia sẻ mã này cho bất kỳ ai.</p>
            </div>
            <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">© 2026 SmartStudy EdTech • Nhóm 23CN4</p>
        </div>
        """
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [to_email], msg.as_string())
        server.quit()
        logger.info(f"✅ Đã gửi email OTP thành công tới: {to_email}")
        return {"sent": True, "message": "Mã xác thực đã được gửi về hòm thư của bạn!"}
    except Exception as e:
        logger.error(f"❌ Lỗi gửi email: {e}")
        return {
            "sent": False,
            "dev_hint": otp_code if ALLOW_DEV_OTP_HINT else None,
            "message": f"Không thể gửi email: {str(e)}"
        }

class AuthService:
    @staticmethod
    def register(email: str, full_name: str, password: str, avatar: str = "🐱") -> Dict[str, Any]:
        email = email.strip().lower()
        full_name = full_name.strip()
        if len(password) < 6:
            raise ValueError("Mật khẩu cần tối thiểu 6 ký tự!")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, email_verified FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()

        if existing:
            conn.close()
            raise ValueError("Email này đã được đăng ký trong hệ thống!")

        hashed = hash_password(password)
        cursor.execute(
            "INSERT INTO users (email, full_name, password_hash, avatar, email_verified) VALUES (?, ?, ?, ?, ?)",
            (email, full_name, hashed, avatar, 0)
        )
        user_id = cursor.lastrowid

        # Sinh mã OTP 6 số
        otp_code = str(secrets.randbelow(900000) + 100000)
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        cursor.execute(
            "INSERT INTO otps (email, otp_code, type, expires_at) VALUES (?, ?, ?, ?)",
            (email, otp_code, "verify-email", expires_at)
        )
        conn.commit()
        conn.close()

        email_result = send_otp_email(email, otp_code, "Kích hoạt tài khoản")
        return {
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "avatar": avatar,
            "dev_otp": email_result.get("dev_hint"),
            "message": "Đăng ký thành công! Vui lòng nhập mã OTP để kích hoạt."
        }

    @staticmethod
    def verify_email_otp(email: str, otp_code: str) -> Dict[str, Any]:
        email = email.strip().lower()
        otp_code = otp_code.strip()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, expires_at FROM otps WHERE email = ? AND otp_code = ? AND type = 'verify-email' ORDER BY id DESC LIMIT 1",
            (email, otp_code)
        )
        record = cursor.fetchone()
        if not record:
            conn.close()
            raise ValueError("Mã OTP không đúng hoặc đã hết hạn!")

        cursor.execute("UPDATE users SET email_verified = 1 WHERE email = ?", (email,))
        cursor.execute("DELETE FROM otps WHERE email = ? AND type = 'verify-email'", (email,))
        
        cursor.execute("SELECT id, email, full_name, avatar, role FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.commit()
        conn.close()

        token = create_jwt_token(user["id"], user["email"], user["full_name"], user["avatar"])
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "avatar": user["avatar"],
                "role": user["role"]
            }
        }

    @staticmethod
    def login(email: str, password: str) -> Dict[str, Any]:
        email = email.strip().lower()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, full_name, password_hash, avatar, role, email_verified FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if not user or not verify_password(password, user["password_hash"]):
            raise ValueError("Email hoặc mật khẩu không chính xác!")

        token = create_jwt_token(user["id"], user["email"], user["full_name"], user["avatar"])
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "avatar": user["avatar"],
                "role": user["role"],
                "email_verified": bool(user["email_verified"])
            }
        }

    @staticmethod
    def resend_otp(email: str, otp_type: str = "verify-email") -> Dict[str, Any]:
        email = email.strip().lower()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if not cursor.fetchone():
            conn.close()
            raise ValueError("Email chưa tồn tại trong hệ thống!")

        otp_code = str(secrets.randbelow(900000) + 100000)
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        cursor.execute("DELETE FROM otps WHERE email = ? AND type = ?", (email, otp_type))
        cursor.execute("INSERT INTO otps (email, otp_code, type, expires_at) VALUES (?, ?, ?, ?)", (email, otp_code, otp_type, expires_at))
        conn.commit()
        conn.close()

        email_result = send_otp_email(email, otp_code, "Mã OTP mới")
        return {
            "dev_otp": email_result.get("dev_hint"),
            "message": "Đã tạo mã OTP mới thành công!"
        }

    @staticmethod
    def save_quiz_score(user_id: int, document_source: str, score_10: float, correct_count: int, total_questions: int, difficulty: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO quiz_history (user_id, document_source, score_10, correct_count, total_questions, difficulty)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, document_source, score_10, correct_count, total_questions, difficulty))
        conn.commit()
        conn.close()

    @staticmethod
    def get_user_quiz_history(user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, document_source, score_10, correct_count, total_questions, difficulty, created_at
            FROM quiz_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 20
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
