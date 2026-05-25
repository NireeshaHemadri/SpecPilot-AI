import os
import re
import json
import requests
from typing import Dict, Any

# Optional imports handled gracefully
try:
    import spacy
except ImportError:
    spacy = None

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    import torch
except ImportError:
    AutoTokenizer, AutoModelForSeq2SeqLM, torch = None, None, None

class NLPEngine:
    def __init__(self, model_dir: str = "fine_tuned_model"):
        self.model_dir = model_dir
        self.nlp = None
        self.tokenizer = None
        self.model = None
        
        # Load spaCy model for rule-based parsing if available
        if spacy:
            try:
                # Try loading the default small English model
                self.nlp = spacy.load("en_core_web_sm")
            except OSError:
                # Fallback: we will load spacy model dynamically or use regex if failing
                pass

    def generate_with_openai(self, user_story: str, criteria: str, api_key: str) -> str:
        """Use OpenAI GPT-4 API to generate Gherkin BDD scenarios."""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        prompt = f"""
You are an expert QA Engineer. Convert the following User Story and Acceptance Criteria into high-quality Gherkin BDD test cases.
Make sure to include a Feature title and one or more Scenarios with Given, When, Then, and And clauses.

User Story:
{user_story}

Acceptance Criteria:
{criteria}

Return ONLY the Gherkin text. Do not write any markdown code blocks or explanations.
"""
        payload = {
            "model": "gpt-4",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            res_json = response.json()
            return res_json["choices"][0]["message"]["content"].strip()
        except Exception as e:
            return f"Error calling OpenAI API: {str(e)}"

    def generate_with_transformer(self, user_story: str, criteria: str) -> str:
        """Use local Seq2Seq model (Flan-T5) to generate Gherkin."""
        if not AutoTokenizer or not AutoModelForSeq2SeqLM:
            return "Transformers package not installed. Falling back to NLP Rule-Based engine."
        
        # Resolve which model path to load
        model_path = self.model_dir if os.path.exists(self.model_dir) else "google/flan-t5-small"
        
        try:
            if not self.tokenizer or not self.model:
                print(f"Loading transformer tokenizer and model from {model_path}...")
                self.tokenizer = AutoTokenizer.from_pretrained(model_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(model_path)

            input_text = f"generate gherkin bdd: user story: {user_story} | criteria: {criteria}"
            inputs = self.tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs["input_ids"], 
                    max_length=512, 
                    num_beams=4, 
                    early_stopping=True
                )
            
            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            return generated_text.replace(" | ", "\n").replace("\\n", "\n")
        except Exception as e:
            return f"Error with Local Transformer (falling back): {str(e)}\n\n" + self.generate_with_rules(user_story, criteria)

    def generate_with_rules(self, user_story: str, criteria: str) -> str:
        """
        Rule-Based NLP Engine using regex patterns and spaCy POS tags.
        It parses the story title and line-by-line acceptance criteria.
        """
        # Parse Feature Name from User Story
        feature_name = "System Operation"
        story_match = re.search(r"As a[n]?\s+([^,]+),\s+I want to\s+(.+?)\s+so that\s+(.+)", user_story, re.IGNORECASE)
        if story_match:
            feature_name = story_match.group(2).strip().title()
        else:
            # Fallback if story format doesn't match standard template
            words = user_story.split()
            if len(words) > 4:
                feature_name = " ".join(words[2:6]).title()

        gherkin_lines = [
            f"Feature: {feature_name}",
            f"  As a user",
            f"  I want to perform actions based on story: {user_story[:60]}...",
            "",
            "  Scenario: Verify criteria checklist"
        ]

        # Process Acceptance Criteria line-by-line
        lines = [line.strip() for line in criteria.split("\n") if line.strip()]
        
        given_added = False
        when_added = False
        then_added = False

        for line in lines:
            # Clean bullet points, numbers, and punctuation
            cleaned = re.sub(r"^[-*•\d\.\s]+", "", line).strip()
            if not cleaned:
                continue

            # Standardize step identification
            lowered = cleaned.lower()
            
            # 1. Given cases (Initial state or location)
            if any(k in lowered for k in ["is on", "navigates to", "goes to", "url", "logged in", "starts at"]) or ("on" in lowered and "page" in lowered):
                step_type = "And" if given_added else "Given"
                # Parse specific URL or page name
                page_match = re.search(r"(?:on|to|at)\s+(?:the\s+)?([\w\s-]+page|https?://[^\s]+|/[\w/-]*)", cleaned, re.IGNORECASE)
                page = page_match.group(1).strip() if page_match else "landing page"
                
                gherkin_lines.append(f"    {step_type} the user is on the {page}")
                given_added = True

            # 2. Then cases (Expected outcomes / Assertions)
            elif any(k in lowered for k in ["should", "redirect", "display", "show", "toast", "message", "error", "success", "assert", "welcome"]):
                step_type = "And" if then_added else "Then"
                
                # Check for quotes inside the criteria line for assertions
                quotes = re.findall(r"['\"]([^'\"]+)['\"]", cleaned)
                quote_text = f' "{quotes[0]}"' if quotes else ""
                
                if "redirect" in lowered:
                    dest = re.search(r"(?:to)\s+(?:the\s+)?([\w\s/\-]+)", cleaned, re.IGNORECASE)
                    dest_str = dest.group(1).strip() if dest else "dashboard"
                    gherkin_lines.append(f"    {step_type} the user should be redirected to the {dest_str}")
                elif "toast" in lowered or "message" in lowered or "banner" in lowered:
                    msg_type = "toast message" if "toast" in lowered else ("success banner" if "success" in lowered else "message")
                    gherkin_lines.append(f"    {step_type} the user should see the {msg_type}{quote_text}")
                else:
                    # Clean trailing period
                    clean_then = cleaned.replace("should", "").replace("User should", "").replace("System should", "").strip()
                    gherkin_lines.append(f"    {step_type} the user {clean_then}")
                then_added = True

            # 3. When cases (User Actions / Inputs)
            else:
                step_type = "And" if when_added else "When"
                
                # Look for input fields and values
                quotes = re.findall(r"['\"]([^'\"]+)['\"]", cleaned)
                
                # Analyze common user action verbs
                if any(v in lowered for v in ["click", "press", "tap"]):
                    # Identify button or element clicked
                    btn_match = re.search(r"(?:click|press|tap)(?:s|ed|ing)?\s+(?:on\s+)?(?:the\s+)?['\"]?([\w\s-]+)['\"]?", cleaned, re.IGNORECASE)
                    btn = btn_match.group(1).strip() if btn_match else "button"
                    gherkin_lines.append(f"    {step_type} the user clicks the \"{btn}\" button")
                elif any(v in lowered for v in ["fill", "enter", "type", "input"]):
                    # Find field name and value
                    field_match = re.search(r"(?:enter|input|fill)(?:s|ed|ing)?\s+(?:value\s+)?(?:for\s+)?(?:the\s+)?([\w\s-]+)\s+(?:with|as|to|into)\s+['\"]?([\w\s\-\.\@\+\/]+)['\"]?", cleaned, re.IGNORECASE)
                    
                    if field_match:
                        field, val = field_match.group(1).strip(), field_match.group(2).strip()
                    else:
                        # Fallback heuristic
                        field = "input field"
                        val = quotes[0] if quotes else "test value"
                        
                        # Try to detect field name from common words
                        for word in ["email", "username", "password", "search", "name"]:
                            if word in lowered:
                                field = word
                                break
                    
                    gherkin_lines.append(f"    {step_type} the user enters \"{val}\" into the {field} field")
                else:
                    # Generic action step
                    gherkin_lines.append(f"    {step_type} the user performs action \"{cleaned}\"")
                when_added = True

        return "\n".join(gherkin_lines)

    def process(self, user_story: str, criteria: str, mode: str = "rules", api_key: str = None) -> str:
        """Main entry point to execute BDD generation based on chosen mode."""
        if mode == "openai" and api_key:
            return self.generate_with_openai(user_story, criteria, api_key)
        elif mode == "transformer":
            return self.generate_with_transformer(user_story, criteria)
        else:
            return self.generate_with_rules(user_story, criteria)
