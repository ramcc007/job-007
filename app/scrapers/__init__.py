from app.scrapers.foundit import FounditScraper
from app.scrapers.indeed import IndeedScraper
from app.scrapers.instahyre import InstahyreScraper
from app.scrapers.linkedin import LinkedInScraper
from app.scrapers.naukri import NaukriScraper

ALL_SCRAPERS = {
    "naukri": NaukriScraper(),
    "linkedin": LinkedInScraper(),
    "instahyre": InstahyreScraper(),
    "indeed": IndeedScraper(),
    "foundit": FounditScraper(),
}
