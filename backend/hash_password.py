"""Generate ADMIN_PASSWORD_HASH (and a JWT_SECRET) for the backend env.
Usage:  python hash_password.py            (prompts)
        python hash_password.py 'my pass'  (non-interactive)"""
import getpass, secrets, sys
from auth import hash_password

pw = sys.argv[1] if len(sys.argv) > 1 else getpass.getpass("Admin password: ")
if len(pw) < 10:
    sys.exit("Use at least 10 characters.")
if len(sys.argv) == 1 and getpass.getpass("Again: ") != pw:
    sys.exit("Passwords don't match.")
print(f"ADMIN_PASSWORD_HASH={hash_password(pw)}")
print(f"JWT_SECRET={secrets.token_urlsafe(48)}   # if you don't have one yet")
