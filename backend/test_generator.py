import unittest
from nlp_engine import NLPEngine
from generator import CodeGenerator

class TestGenerator(unittest.TestCase):
    def setUp(self):
        self.nlp = NLPEngine()
        self.gen = CodeGenerator()

    def test_nlp_rule_based_generation(self):
        user_story = "As a user, I want to log in to my dashboard so that I can manage my work."
        criteria = (
            "- User is on the login page\n"
            "- User enters 'testuser' into the username field\n"
            "- User enters 'pass123' into the password field\n"
            "- User clicks the 'Submit' button\n"
            "- Redirect user to the dashboard page"
        )
        
        gherkin = self.nlp.process(user_story, criteria, mode="rules")
        
        self.assertIn("Feature: Log In To My Dashboard", gherkin)
        self.assertIn("Scenario: Verify criteria checklist", gherkin)
        self.assertIn("Given the user is on the login page", gherkin)
        self.assertIn('When the user enters "testuser" into the username field', gherkin)
        self.assertIn('And the user enters "pass123" into the password field', gherkin)
        self.assertIn('And the user clicks the "Submit" button', gherkin)
        self.assertIn("Then the user should be redirected to the dashboard page", gherkin)

    def test_code_generator_translation(self):
        gherkin = (
            "Feature: User Login\n"
            "  Scenario: Successful Login\n"
            "    Given the user is on the login page\n"
            '    When the user enters "admin" into the username field\n'
            '    And the user clicks the "Submit" button\n'
            "    Then the user should be redirected to the dashboard page"
        )

        assets = self.gen.generate(gherkin)
        
        # Verify assets structure
        self.assertIn("spec_code", assets)
        self.assertIn("pages", assets)
        
        # Verify page classes
        pages = assets["pages"]
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["name"], "LoginPage")
        self.assertEqual(pages[0]["filename"], "LoginPage.ts")
        
        # Verify page class code
        page_code = pages[0]["code"]
        self.assertIn("export class LoginPage", page_code)
        self.assertIn("readonly usernameInput: Locator;", page_code)
        self.assertIn("readonly submitButton: Locator;", page_code)
        self.assertIn("await this.page.goto('/login');", page_code)
        
        # Verify spec code
        spec_code = assets["spec_code"]
        self.assertIn("import { test, expect } from '@playwright/test';", spec_code)
        self.assertIn("import { LoginPage } from '../pages/LoginPage';", spec_code)
        self.assertIn("test('Successful Login', async ({ page }) => {", spec_code)
        self.assertIn("const loginPage = new LoginPage(page);", spec_code)
        self.assertIn("await loginPage.navigate();", spec_code)
        self.assertIn("await loginPage.usernameInput.fill('admin');", spec_code)
        self.assertIn("await loginPage.submitButton.click();", spec_code)
        self.assertIn("await expect(page).toHaveURL(/.*dashboard/);", spec_code)

if __name__ == "__main__":
    unittest.main()
