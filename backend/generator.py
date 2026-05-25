import re
from typing import Dict, List, Any, Tuple

class CodeGenerator:
    def __init__(self):
        pass

    def clean_name(self, name: str) -> str:
        """Sanitize strings for variable and file names."""
        name = re.sub(r'[^a-zA-Z0-9\s]', '', name)
        words = name.split()
        if not words:
            return "Page"
        return "".join(word.capitalize() for word in words)

    def extract_element_info(self, step_text: str) -> Tuple[str, str, str]:
        """
        Parses step text to identify elements, values, and selectors.
        Returns (element_key, element_selector, test_value)
        """
        # Look for quoted text
        quotes = re.findall(r'"([^"]+)"', step_text)
        val = quotes[0] if quotes else ""
        
        # Analyze action text for inputs
        if "enter" in step_text or "type" in step_text or "fill" in step_text:
            field_match = re.search(r'(?:into|in)\s+(?:the\s+)?([\w\s-]+?)(?:\s+field|\s+input|$)', step_text, re.IGNORECASE)
            field_name = field_match.group(1).strip() if field_match else "input"
            
            clean_field = self.clean_name(field_name)
            elem_key = clean_field[0].lower() + clean_field[1:] + "Input"
            
            # Smart selector guessing
            selector = f"input[name='{field_name.lower()}'], #{field_name.lower()}, [placeholder*='{field_name}' i]"
            return elem_key, selector, val
            
        # Analyze action text for buttons
        elif "click" in step_text or "press" in step_text:
            btn_match = re.search(r'(?:click|press)\s+(?:the\s+)?(?:on\s+)?"([^"]+)"', step_text, re.IGNORECASE)
            if not btn_match:
                btn_match = re.search(r'(?:click|press)\s+(?:the\s+)?([\w\s-]+?)(?:\s+button|\s+link|$)', step_text, re.IGNORECASE)
            
            btn_name = btn_match.group(1).strip() if btn_match else "submit"
            clean_btn = self.clean_name(btn_name)
            elem_key = clean_btn[0].lower() + clean_btn[1:] + "Button"
            
            selector = f"button:has-text('{btn_name}'), input[type='submit'], #{btn_name.lower()}-btn"
            return elem_key, selector, val

        # Analyze assertions
        elif "see" in step_text or "contain" in step_text or "display" in step_text:
            elem_match = re.search(r'(?:see|contain|display)\s+(?:the\s+)?([\w\s-]+)', step_text, re.IGNORECASE)
            elem_name = elem_match.group(1).strip() if elem_match else "element"
            # Remove quoted text if it was part of it
            elem_name = re.sub(r'"[^"]+"', '', elem_name).strip()
            
            clean_elem = self.clean_name(elem_name)
            elem_key = clean_elem[0].lower() + clean_elem[1:] + "Element"
            
            selector = f"text='{val}'" if val else f".{elem_name.lower().replace(' ', '-')}, #{elem_name.lower().replace(' ', '_')}"
            return elem_key, selector, val

        return "genericElement", "body", val

    def generate(self, gherkin_text: str) -> Dict[str, Any]:
        """Translates Gherkin BDD into Page Objects and Spec script."""
        lines = gherkin_text.split("\n")
        
        feature_name = "Feature Test"
        scenarios = []
        current_scenario = None
        
        # Intermediate parsing structure
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith("Feature:"):
                feature_name = line.replace("Feature:", "").strip()
            elif line.startswith("Scenario:"):
                scenario_name = line.replace("Scenario:", "").strip()
                current_scenario = {
                    "name": scenario_name,
                    "steps": []
                }
                scenarios.append(current_scenario)
            elif current_scenario is not None and (
                line.startswith("Given") or 
                line.startswith("When") or 
                line.startswith("Then") or 
                line.startswith("And") or 
                line.startswith("But")
            ):
                current_scenario["steps"].append(line)

        # Build Page Objects dictionary
        # page_name -> { locators: {key: selector}, paths: [urls] }
        pages: Dict[str, Dict[str, Any]] = {}
        current_page_name = "MainPage"
        
        nlp_entities = []
        
        # Populate pages and elements by analyzing Given steps
        for sc in scenarios:
            for step in sc["steps"]:
                if "user is on" in step or "user navigates to" in step:
                    # Extract page name
                    page_match = re.search(r"(?:on|to|at)\s+(?:the\s+)?([\w\s-]+?)(?:\s+page|\s+view|$)", step, re.IGNORECASE)
                    if page_match:
                        raw_page = page_match.group(1).strip()
                        current_page_name = self.clean_name(raw_page) + "Page"
                    
                    if current_page_name not in pages:
                        pages[current_page_name] = {
                            "locators": {},
                            "urls": []
                        }
                    
                    # Guess URL path
                    url_guess = "/" + current_page_name.lower().replace("page", "")
                    if "login" in url_guess:
                        url_guess = "/login"
                    elif "main" in url_guess or "home" in url_guess:
                        url_guess = "/"
                    elif "dashboard" in url_guess:
                        url_guess = "/dashboard"
                    
                    if url_guess not in pages[current_page_name]["urls"]:
                        pages[current_page_name]["urls"].append(url_guess)

                    nlp_entities.append({
                        "step": step,
                        "token": page_match.group(1).strip() if page_match else "landing",
                        "label": "PAGE_NAVIGATION",
                        "action": "goto()",
                        "selector": url_guess
                    })
                
                # Check for elements in when/then steps
                elif current_page_name:
                    if current_page_name not in pages:
                        pages[current_page_name] = {"locators": {}, "urls": ["/"]}
                    
                    key, selector, val = self.extract_element_info(step)
                    if key != "genericElement" and key not in pages[current_page_name]["locators"]:
                        pages[current_page_name]["locators"][key] = selector

                    # Deduce label and action
                    label = "GENERIC"
                    action = "unknown"
                    if any(v in step.lower() for v in ["enter", "type", "fill"]):
                        label = "INPUT_FIELD"
                        action = f"fill('{val}')"
                    elif any(v in step.lower() for v in ["click", "press"]):
                        label = "CLICKABLE_ELEMENT"
                        action = "click()"
                    elif any(v in step.lower() for v in ["see", "contain", "display", "visible"]):
                        label = "EXPECT_ASSERTION"
                        action = "toHaveText()" if val else "toBeVisible()"
                    
                    nlp_entities.append({
                        "step": step,
                        "token": val or key,
                        "label": label,
                        "action": action,
                        "selector": selector
                    })

        # Generate POM TS Code
        generated_pages = []
        for p_name, p_data in pages.items():
            locators_code = ""
            init_code = ""
            
            for key, sel in p_data["locators"].items():
                locators_code += f"  readonly {key}: Locator;\n"
                init_code += f"    this.{key} = page.locator(\"{sel}\");\n"
            
            default_url = p_data["urls"][0] if p_data["urls"] else "/"
            
            pom_code = f"""import {{ Page, Locator }} from '@playwright/test';

export class {p_name} {{
  readonly page: Page;
{locators_code}
  constructor(page: Page) {{
    this.page = page;
{init_code}  }}

  async navigate() {{
    await this.page.goto('{default_url}');
  }}
}}
"""
            generated_pages.append({
                "name": p_name,
                "filename": f"{p_name}.ts",
                "code": pom_code
            })

        # Generate Playwright test spec code
        imports = "import { test, expect } from '@playwright/test';\n"
        for p_name in pages.keys():
            imports += f"import {{ {p_name} }} from '../pages/{p_name}';\n"
        
        spec_code = f"{imports}\n"
        spec_code += f"test.describe('{feature_name}', () => {{\n"
        
        for sc in scenarios:
            spec_code += f"\n  test('{sc['name']}', async ({{ page }}) => {{\n"
            
            # Track current active page instance inside the test
            active_page_name = None
            instantiated_pages = set()
            
            for step in sc["steps"]:
                spec_code += f"    // {step}\n"
                
                # Page routing
                if "user is on" in step or "user navigates to" in step:
                    page_match = re.search(r"(?:on|to|at)\s+(?:the\s+)?([\w\s-]+?)(?:\s+page|\s+view|$)", step, re.IGNORECASE)
                    p_name = self.clean_name(page_match.group(1).strip()) + "Page" if page_match else "MainPage"
                    
                    var_name = p_name[0].lower() + p_name[1:]
                    if var_name not in instantiated_pages:
                        spec_code += f"    const {var_name} = new {p_name}(page);\n"
                        instantiated_pages.add(var_name)
                    
                    spec_code += f"    await {var_name}.navigate();\n"
                    active_page_name = var_name
                
                # Redirect assertions
                elif "redirect" in step.lower() or "navigate" in step.lower():
                    dest_match = re.search(r"(?:redirected to|navigated to|navigate to|go to|goes to|to)\s+(?:the\s+)?([\w\s/\-]+)", step, re.IGNORECASE)
                    dest = dest_match.group(1).strip().lower() if dest_match else "dashboard"
                    # Remove trailing 'page' or 'view'
                    dest = re.sub(r'\s+(?:page|view)$', '', dest)
                    spec_code += f"    await expect(page).toHaveURL(/.*{dest}/);\n"
                
                # Fill action steps
                elif any(v in step.lower() for v in ["enter", "type", "fill"]):
                    elem_key, _, val = self.extract_element_info(step)
                    if not active_page_name:
                        # Fallback page instantiation
                        active_page_name = "mainPage"
                        if active_page_name not in instantiated_pages:
                            spec_code += f"    const {active_page_name} = new MainPage(page);\n"
                            instantiated_pages.add(active_page_name)
                    
                    spec_code += f"    await {active_page_name}.{elem_key}.fill('{val}');\n"
                
                # Click action steps
                elif any(v in step.lower() for v in ["click", "press"]):
                    elem_key, _, _ = self.extract_element_info(step)
                    if not active_page_name:
                        active_page_name = "mainPage"
                        if active_page_name not in instantiated_pages:
                            spec_code += f"    const {active_page_name} = new MainPage(page);\n"
                            instantiated_pages.add(active_page_name)
                    
                    spec_code += f"    await {active_page_name}.{elem_key}.click();\n"
                
                # Element assertions (should see, should display, etc.)
                elif any(v in step.lower() for v in ["see", "contain", "display", "visible"]):
                    elem_key, _, val = self.extract_element_info(step)
                    if not active_page_name:
                        active_page_name = "mainPage"
                        if active_page_name not in instantiated_pages:
                            spec_code += f"    const {active_page_name} = new MainPage(page);\n"
                            instantiated_pages.add(active_page_name)
                    
                    if val:
                        spec_code += f"    await expect({active_page_name}.{elem_key}).toContainText('{val}');\n"
                    else:
                        spec_code += f"    await expect({active_page_name}.{elem_key}).toBeVisible();\n"
            
            spec_code += "  });\n"
            
        spec_code += "});\n"
        
        return {
            "spec_code": spec_code,
            "pages": generated_pages,
            "nlp_entities": nlp_entities
        }
