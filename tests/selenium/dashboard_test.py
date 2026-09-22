"""
Cleano Admin Dashboard - Selenium Test Suite
Run: pip install selenium webdriver-manager  then  python dashboard_test.py
"""

import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# ─── Config ───────────────────────────────────────────────────
BASE_URL = "https://laundry-bag-admin-dashboard-p0ur4h9z9-eagels.vercel.app"
ADMIN_EMAIL = "jejihe6435@94an.com"
ADMIN_PASSWORD = "Hassan@123"
TIMEOUT = 15


def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    # options.add_argument("--headless")  # شيل الكومنت لو عايز يشتغل من غير ما يفتح المتصفح
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    driver.implicitly_wait(10)
    return driver


def wait_for(driver, by, value, timeout=TIMEOUT):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, value))
    )


def wait_clickable(driver, by, value, timeout=TIMEOUT):
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((by, value))
    )


# ─── Tests ────────────────────────────────────────────────────

class DashboardTests:
    def __init__(self):
        self.driver = setup_driver()
        self.passed = 0
        self.failed = 0

    def log(self, name, success, detail=""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} — {name}" + (f" ({detail})" if detail else ""))
        if success:
            self.passed += 1
        else:
            self.failed += 1

    def test_login_page_loads(self):
        """صفحة اللوجن بتفتح"""
        self.driver.get(f"{BASE_URL}/login")
        time.sleep(2)
        try:
            email_input = wait_for(self.driver, By.CSS_SELECTOR, 'input[type="email"]')
            self.log("Login page loads", email_input.is_displayed())
        except Exception as e:
            self.log("Login page loads", False, str(e))

    def test_login_with_credentials(self):
        """الدخول ببيانات الأدمن"""
        try:
            email_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="email"]')
            password_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="password"]')

            email_input.clear()
            email_input.send_keys(ADMIN_EMAIL)
            password_input.clear()
            password_input.send_keys(ADMIN_PASSWORD)

            submit_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
            submit_btn.click()

            time.sleep(4)
            current_url = self.driver.current_url
            logged_in = "/login" not in current_url
            self.log("Login with credentials", logged_in, f"URL: {current_url}")
        except Exception as e:
            self.log("Login with credentials", False, str(e))

    def test_dashboard_home_loads(self):
        """الصفحة الرئيسية بتحمل بعد اللوجن"""
        try:
            time.sleep(2)
            body = self.driver.find_element(By.TAG_NAME, "body")
            self.log("Dashboard home loads", body.is_displayed())
        except Exception as e:
            self.log("Dashboard home loads", False, str(e))

    def test_orders_page(self):
        """صفحة الأوردرات بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/orders")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            has_content = len(page_text) > 50
            self.log("Orders page loads", has_content)
        except Exception as e:
            self.log("Orders page loads", False, str(e))

    def test_customers_page(self):
        """صفحة العملاء بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/customers")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            self.log("Customers page loads", len(page_text) > 50)
        except Exception as e:
            self.log("Customers page loads", False, str(e))

    def test_drivers_page(self):
        """صفحة السائقين بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/drivers")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            self.log("Drivers page loads", len(page_text) > 50)
        except Exception as e:
            self.log("Drivers page loads", False, str(e))

    def test_finance_page(self):
        """صفحة المالية بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/finance")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            self.log("Finance page loads", len(page_text) > 50)
        except Exception as e:
            self.log("Finance page loads", False, str(e))

    def test_prices_page(self):
        """صفحة الأسعار بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/prices")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            self.log("Prices page loads", len(page_text) > 50)
        except Exception as e:
            self.log("Prices page loads", False, str(e))

    def test_settings_page(self):
        """صفحة الإعدادات بتفتح"""
        try:
            self.driver.get(f"{BASE_URL}/settings")
            time.sleep(3)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            self.log("Settings page loads", len(page_text) > 50)
        except Exception as e:
            self.log("Settings page loads", False, str(e))

    def test_sidebar_navigation(self):
        """النافيجيشن من السايدبار شغال"""
        try:
            self.driver.get(BASE_URL)
            time.sleep(2)
            links = self.driver.find_elements(By.CSS_SELECTOR, "a[href]")
            nav_links = [l for l in links if any(
                p in (l.get_attribute("href") or "")
                for p in ["/orders", "/customers", "/drivers", "/finance"]
            )]
            self.log("Sidebar has nav links", len(nav_links) >= 3, f"Found {len(nav_links)} links")
        except Exception as e:
            self.log("Sidebar navigation", False, str(e))

    def test_responsive_mobile(self):
        """الداشبورد ريسبونسيف على موبايل"""
        try:
            self.driver.set_window_size(375, 812)
            time.sleep(1)
            body = self.driver.find_element(By.TAG_NAME, "body")
            no_h_scroll = self.driver.execute_script(
                "return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 5"
            )
            self.log("Responsive (mobile 375px)", no_h_scroll)
            self.driver.maximize_window()
        except Exception as e:
            self.log("Responsive (mobile)", False, str(e))
            self.driver.maximize_window()

    def test_logout(self):
        """تسجيل الخروج"""
        try:
            self.driver.get(f"{BASE_URL}/profile")
            time.sleep(2)
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            logout_btn = None
            for btn in buttons:
                text = btn.text.lower()
                if "logout" in text or "sign out" in text or "خروج" in text:
                    logout_btn = btn
                    break
            if logout_btn:
                logout_btn.click()
                time.sleep(3)
                self.log("Logout", "/login" in self.driver.current_url)
            else:
                self.log("Logout", False, "Logout button not found")
        except Exception as e:
            self.log("Logout", False, str(e))

    def run_all(self):
        print(f"\n{'='*50}")
        print(f"  Cleano Dashboard — Selenium Tests")
        print(f"  URL: {BASE_URL}")
        print(f"{'='*50}\n")

        tests = [
            self.test_login_page_loads,
            self.test_login_with_credentials,
            self.test_dashboard_home_loads,
            self.test_orders_page,
            self.test_customers_page,
            self.test_drivers_page,
            self.test_finance_page,
            self.test_prices_page,
            self.test_settings_page,
            self.test_sidebar_navigation,
            self.test_responsive_mobile,
            self.test_logout,
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                self.log(test.__doc__ or test.__name__, False, f"Unexpected: {e}")

        print(f"\n{'='*50}")
        print(f"  Results: {self.passed} passed, {self.failed} failed, {self.passed + self.failed} total")
        print(f"{'='*50}\n")

        self.driver.quit()
        return self.failed == 0


if __name__ == "__main__":
    tester = DashboardTests()
    success = tester.run_all()
    sys.exit(0 if success else 1)
