import jwt
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models

SECRET = "whereismybus_kottayam_secret_2024"
ALGO = "HS256"
EXPIRY_HOURS = 24

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=EXPIRY_HOURS)
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def verify_token(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        user_id = int(payload["sub"])
        return db.query(models.User).filter(models.User.id == user_id).first()
    except Exception:
        return None
