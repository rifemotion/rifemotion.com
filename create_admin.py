#!/usr/bin/env python3
"""
CLI tool to create or reset an admin user for RifeMotion.
Usage:
    python create_admin.py --username admin --password mysecretpass
    python create_admin.py (interactive prompt)
"""
import sys
import getpass
import argparse
from app.database import SessionLocal, init_db
from app.models import AdminUser
from app.auth import hash_password

def create_admin(username: str, password: str, reset_2fa: bool = False):
    init_db()
    db = SessionLocal()
    try:
        username = username.strip().lower()
        user = db.query(AdminUser).filter(AdminUser.username == username).first()
        
        pwd_hash, salt = hash_password(password)

        if user:
            print(f"[*] Пользователь '{username}' уже существует. Обновление пароля...")
            user.password_hash = pwd_hash
            user.salt = salt
            if reset_2fa:
                user.totp_secret = None
                user.is_2fa_enabled = False
                print("[*] 2FA сброшена. При следующем входе потребуется настроить 2FA заново через QR-код.")
            db.commit()
            print(f"[+] Пароль для пользователя '{username}' успешно обновлен!")
        else:
            new_user = AdminUser(
                username=username,
                password_hash=pwd_hash,
                salt=salt,
                totp_secret=None,
                is_2fa_enabled=False
            )
            db.add(new_user)
            db.commit()
            print(f"[+] Администратор '{username}' успешно создан!")
            print("[i] При первом входе в /admin/login вам будет предложено отсканировать QR-код для настройки 2FA.")

    except Exception as e:
        db.rollback()
        print(f"[-] Ошибка: {e}", file=sys.stderr)
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Создание учетной записи администратора")
    parser.add_argument("--username", "-u", type=str, help="Имя пользователя (логин)")
    parser.add_argument("--password", "-p", type=str, help="Пароль")
    parser.add_argument("--reset-2fa", action="store_true", help="Сбросить 2FA для существующего пользователя")

    args = parser.parse_args()

    username = args.username
    password = args.password

    if not username:
        username = input("Введите имя администратора (default: admin): ").strip() or "admin"

    if not password:
        password = getpass.getpass("Введите надежный пароль: ")
        confirm_password = getpass.getpass("Повторите пароль: ")
        if password != confirm_password:
            print("[-] Ошибка: Пароли не совпадают!")
            sys.exit(1)
        if len(password) < 6:
            print("[-] Ошибка: Пароль должен быть длиной не менее 6 символов!")
            sys.exit(1)

    create_admin(username, password, reset_2fa=args.reset_2fa)
