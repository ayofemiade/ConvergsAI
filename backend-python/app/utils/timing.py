import time
from functools import wraps
from app.logger_config import logger

def timeit(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        end = time.perf_counter()
        logger.debug(f"{func.__name__} took {end - start:.4f} seconds")
        return result
    return wrapper
