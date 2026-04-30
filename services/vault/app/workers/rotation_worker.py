import logging
import time

from app.bootstrap.seed import ensure_seed_identities, init_schema
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.tracking_service import mark_expired_access_requests


settings = get_settings()
logger = logging.getLogger("tracking-worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


def run() -> None:
    # We do not run init_schema() here to avoid race conditions with vault-api
    # init_schema()
    # ensure_seed_identities()

    logger.info("tracking worker started with interval=%ss", settings.rotation_scan_interval_seconds)

    while True:
        try:
            with SessionLocal() as db:
                expired_requests = mark_expired_access_requests(db)
                db.commit()
                logger.info("tracking scan complete expired_requests=%s", expired_requests)
        except Exception:
            logger.exception("tracking scan failed")

        time.sleep(settings.rotation_scan_interval_seconds)


if __name__ == "__main__":
    run()
