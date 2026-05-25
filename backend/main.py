import os
import json
import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import io
import zipfile
from fastapi.responses import StreamingResponse

from nlp_engine import NLPEngine
from generator import CodeGenerator
from train import run_training

app = FastAPI(title="BDD & Playwright NLP Code Generator API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
nlp_engine = NLPEngine()
code_generator = CodeGenerator()

# Training status global state
TRAINING_STATUS = {
    "status": "idle",  # idle, training, completed, failed
    "logs": []
}

class GenerateRequest(BaseModel):
    user_story: str = Field(..., description="User story description")
    acceptance_criteria: str = Field(..., description="Acceptance criteria text")
    mode: str = Field("rules", description="NLP execution mode: rules, transformer, or openai")
    api_key: Optional[str] = Field(None, description="OpenAI API Key (optional)")

class DatasetItem(BaseModel):
    user_story: str
    acceptance_criteria: str
    gherkin: str

@app.get("/")
def read_root():
    return {"message": "NLP BDD and Playwright Script Generator API is running!"}

@app.post("/api/generate")
def generate_bdd_and_playwright(req: GenerateRequest):
    try:
        # Step 1: Run NLP engine to generate BDD Gherkin text
        gherkin_text = nlp_engine.process(
            user_story=req.user_story,
            criteria=req.acceptance_criteria,
            mode=req.mode,
            api_key=req.api_key
        )
        
        # Check if error occurred
        if gherkin_text.startswith("Error"):
            raise HTTPException(status_code=500, detail=gherkin_text)

        # Step 2: Compile BDD Gherkin into Playwright POM & Specs
        playwright_assets = code_generator.generate(gherkin_text)

        return {
            "gherkin": gherkin_text,
            "playwright": playwright_assets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

class CompileRequest(BaseModel):
    gherkin: str

@app.post("/api/compile")
def compile_gherkin(req: CompileRequest):
    try:
        playwright_assets = code_generator.generate(req.gherkin)
        return {
            "playwright": playwright_assets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compilation failed: {str(e)}")

class ExportRequest(BaseModel):
    gherkin: str
    spec_code: str
    pages: List[Dict[str, str]]

@app.post("/api/export-zip")
def export_zip(req: ExportRequest):
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            readme = """# Generated Playwright Automation Suite
Created automatically with TestForge AI.

## Folder Structure
- `tests/`: Contains the generated Playwright specifications (`bdd-test.spec.ts`, `test.feature`).
- `pages/`: Contains the modular Page Object Model classes.
- `playwright.config.ts`: Configured for parallel cross-browser runs.
- `.github/workflows/playwright.yml`: Ready-to-go GHA workflow for CI testing.

## Local Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```
3. Run tests:
   ```bash
   npx playwright test
   ```
"""
            zip_file.writestr("README.md", readme)

            config_code = """import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
"""
            zip_file.writestr("playwright.config.ts", config_code)

            package_json = """{
  "name": "playwright-automation",
  "version": "1.0.0",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "typescript": "^5.0.0"
  }
}"""
            zip_file.writestr("package.json", package_json)

            workflow_yml = """name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - name: Install dependencies
      run: npm install
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run tests
      run: npx playwright test
"""
            zip_file.writestr(".github/workflows/playwright.yml", workflow_yml)
            zip_file.writestr("tests/test.feature", req.gherkin)
            zip_file.writestr("tests/bdd-test.spec.ts", req.spec_code)

            for page in req.pages:
                zip_file.writestr(f"pages/{page['filename']}", page['code'])

        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/x-zip-compressed",
            headers={"Content-Disposition": "attachment; filename=playwright-automation-suite.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export ZIP: {str(e)}")

@app.get("/api/dataset", response_model=List[DatasetItem])
def get_dataset():
    dataset_path = os.path.join(os.path.dirname(__file__), "dataset.json")
    if not os.path.exists(dataset_path):
        return []
    try:
        with open(dataset_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")

@app.post("/api/dataset")
def add_dataset_item(item: DatasetItem):
    dataset_path = os.path.join(os.path.dirname(__file__), "dataset.json")
    try:
        data = []
        if os.path.exists(dataset_path):
            with open(dataset_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        
        data.append(item.model_dump())
        
        with open(dataset_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        return {"message": "Dataset entry added successfully", "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add to dataset: {str(e)}")

def async_training_task(dataset_path: str, model_dir: str):
    global TRAINING_STATUS
    TRAINING_STATUS["status"] = "training"
    TRAINING_STATUS["logs"] = ["Training job started.", "Preparing PyTorch datasets..."]
    try:
        # Run local trainer
        run_training(dataset_path=dataset_path, output_dir=model_dir)
        TRAINING_STATUS["status"] = "completed"
        TRAINING_STATUS["logs"].append("Training task completed successfully. Fine-tuned model saved.")
    except Exception as e:
        TRAINING_STATUS["status"] = "failed"
        TRAINING_STATUS["logs"].append(f"Training failed with error: {str(e)}")

@app.post("/api/train")
def trigger_training(background_tasks: BackgroundTasks):
    global TRAINING_STATUS
    if TRAINING_STATUS["status"] == "training":
        return {"message": "Training is already in progress.", "status": TRAINING_STATUS["status"]}
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "dataset.json")
    model_dir = os.path.join(script_dir, "fine_tuned_model")

    # Launch model training in background to avoid client timeouts
    background_tasks.add_task(async_training_task, dataset_path, model_dir)
    return {"message": "Training initiated in background.", "status": "training"}

@app.get("/api/train/status")
def get_training_status():
    global TRAINING_STATUS
    return TRAINING_STATUS

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
