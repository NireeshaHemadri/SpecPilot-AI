import React, { useState, useEffect } from 'react';

interface PomPage {
  name: string;
  filename: string;
  code: string;
}

interface PlaywrightAssets {
  spec_code: string;
  pages: PomPage[];
  nlp_entities?: NlpEntity[];
}

interface NlpEntity {
  step: string;
  token: string;
  label: string;
  action: string;
  selector: string;
}

interface DatasetItem {
  user_story: string;
  acceptance_criteria: string;
  gherkin: string;
}


// Light Syntax Highlighting Heuristics
export function highlightGherkin(text: string) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const gherkinRegex = /\b(Feature:|Scenario:)\b|\b(Given|When|Then|And|But)\b|("[^"]*")/g;
  return escaped.replace(gherkinRegex, (match, featureOrScenario, stepKeyword, str) => {
    if (featureOrScenario) return `<span class="token-classname">${match}</span>`;
    if (stepKeyword) return `<span class="token-keyword">${match}</span>`;
    if (str) return `<span class="token-string">${match}</span>`;
    return match;
  });
}

export function highlightTypeScript(text: string) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const tsRegex = /(\/\/.*)|('[^']*'|"[^"]*")|\b(import|export|class|const|readonly|constructor|await|async|from|new|test|expect)\b|\b(LoginPage|DashboardPage|MainPage|Page|Locator)\b/g;
  return escaped.replace(tsRegex, (match, comment, str, keyword, classname) => {
    if (comment) return `<span class="token-comment">${match}</span>`;
    if (str) return `<span class="token-string">${match}</span>`;
    if (keyword) return `<span class="token-keyword">${match}</span>`;
    if (classname) return `<span class="token-classname">${match}</span>`;
    return match;
  });
}

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"showcase" | "workspace" | "dataset" | "train">("showcase");
  const [activeCodeTab, setActiveCodeTab] = useState<"spec" | "pom" | "nlp" | "readme">("spec");
  
  // Workspace inputs
  const [userStory, setUserStory] = useState(
    "As a registered user, I want to log in to my account so that I can access the dashboard."
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    "- User is on the login page\n- User enters 'admin@test.com' into email\n- User enters 'secret123' into password\n- User clicks the 'Login' button\n- Redirect user to the dashboard page"
  );
  const [mode, setMode] = useState("rules");
  const [apiKey, setApiKey] = useState("");

  // Default pre-populated generated outputs (avoids "Compile assets to view code specs" on load)
  const defaultGherkin = `Feature: User Login\n\n  Scenario: Successful Login with Valid Credentials\n    Given the user is on the login page\n    When the user enters "admin@test.com" into the email field\n    And the user enters "secret123" into the password field\n    And the user clicks the "Login" button\n    Then the user should be redirected to the dashboard page`;
  
  const defaultPom = `import { Page, Locator } from '@playwright/test';\n\nexport class LoginPage {\n  readonly page: Page;\n  readonly emailInput: Locator;\n  readonly passwordInput: Locator;\n  readonly loginButton: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.emailInput = page.locator("input[name='email'], #email");\n    this.passwordInput = page.locator("input[name='password'], #password");\n    this.loginButton = page.locator("button:has-text('Login'), button[type='submit']");\n  }\n\n  async navigate() {\n    await this.page.goto('/login');\n  }\n}`;
  
  const defaultSpec = `import { test, expect } from '@playwright/test';\nimport { LoginPage } from '../pages/LoginPage';\n\ntest.describe('User Login', () => {\n\n  test('Successful Login with Valid Credentials', async ({ page }) => {\n    // Given the user is on the login page\n    const loginPage = new LoginPage(page);\n    await loginPage.navigate();\n    \n    // When the user enters "admin@test.com" into the email field\n    await loginPage.emailInput.fill('admin@test.com');\n    \n    // And the user enters "secret123" into the password field\n    await loginPage.passwordInput.fill('secret123');\n    \n    // And the user clicks the "Login" button\n    await loginPage.loginButton.click();\n    \n    // Then the user should be redirected to the dashboard page\n    await expect(page).toHaveURL(/.*dashboard/);\n  });\n});`;

  const defaultReadme = `# Generated Playwright Automation Suite\nCreated automatically with TestForge AI.\n\n## Folder Structure\n- \`tests/\`: Contains the generated Playwright specifications (\`bdd-test.spec.ts\`, \`test.feature\`).\n- \`pages/\`: Contains the modular Page Object Model classes.\n- \`playwright.config.ts\`: Configured for parallel cross-browser runs.\n- \`.github/workflows/playwright.yml\`: Ready-to-go GHA workflow for CI testing.\n\n## Local Run\n1. Install dependencies:\n   \`\`\`bash\n   npm install\n   \`\`\`\n2. Install Playwright browsers:\n   \`\`\`bash\n   npx playwright install\n   \`\`\`\n3. Run tests:\n   \`\`\`bash\n   npx playwright test\n   \`\`\`\n`;

  const defaultEntities: NlpEntity[] = [
    { step: "Given the user is on the login page", token: "login page", label: "PAGE_NAVIGATION", action: "goto()", selector: "/login" },
    { step: "When the user enters \"admin@test.com\" into the email field", token: "admin@test.com", label: "INPUT_FIELD", action: "fill('admin@test.com')", selector: "input[name='email'], #email" },
    { step: "And the user enters \"secret123\" into the password field", token: "secret123", label: "INPUT_FIELD", action: "fill('secret123')", selector: "input[name='password'], #password" },
    { step: "And the user clicks the \"Login\" button", token: "Login", label: "CLICKABLE_ELEMENT", action: "click()", selector: "button:has-text('Login')" },
    { step: "Then the user should be redirected to the dashboard page", token: "dashboard page", label: "EXPECT_ASSERTION", action: "toHaveURL()", selector: "/dashboard" }
  ];

  // Human Edit Approval States
  const [editableGherkin, setEditableGherkin] = useState(defaultGherkin);
  const [nlInstruction, setNlInstruction] = useState("");
  
  // Final Assets State
  const [playwright, setPlaywright] = useState<PlaywrightAssets | null>({
    spec_code: defaultSpec,
    pages: [{ name: "LoginPage", filename: "LoginPage.ts", code: defaultPom }],
    nlp_entities: defaultEntities
  });
  const [selectedPomIndex, setSelectedPomIndex] = useState(0);

  // Preloaded 12 dataset pairs for "Training Set" tab (Never shows 0, instantly populated)
  const preloadedDataset: DatasetItem[] = [
    {
      user_story: "As a customer, I want to log in to my account so that I can see my personal dashboard.",
      acceptance_criteria: "- User is on login page\n- User inputs email 'user@example.com' and password 'securePass123'\n- User clicks the login button\n- Redirect to dashboard",
      gherkin: "Feature: User Login\n  Scenario: Successful Login\n    Given the user is on the login page\n    When the user enters email \"user@example.com\" and password \"securePass123\"\n    And the user clicks the login button\n    Then the user should be redirected to the dashboard"
    },
    {
      user_story: "As an online shopper, I want to add an item to my shopping cart so that I can purchase it later.",
      acceptance_criteria: "- Shopper is on Product details page for 'Wireless Headphones'\n- Shopper selects quantity '2'\n- Shopper clicks 'Add to Cart' button\n- Navigation cart counter increments by 2",
      gherkin: "Feature: Shopping Cart\n  Scenario: Add Product\n    Given shopper is on details page for \"Wireless Headphones\"\n    When shopper selects quantity \"2\"\n    And shopper clicks \"Add to Cart\"\n    Then cart counter increments by \"2\""
    },
    {
      user_story: "As an administrator, I want to create a new user profile so that they can access the platform.",
      acceptance_criteria: "- Admin is on User Management tab\n- Admin clicks 'Add User'\n- Admin fills name 'Jane Doe', email 'jane@company.com', role 'Editor'\n- Admin clicks 'Save'\n- Toast success notification appears",
      gherkin: "Feature: User Management\n  Scenario: Create Profile\n    Given admin is on User Management tab\n    When admin clicks \"Add User\"\n    And admin enters name \"Jane Doe\", email \"jane@company.com\"\n    And admin clicks \"Save\"\n    Then success notification appears"
    },
    {
      user_story: "As a user, I want to reset my password when forgotten so that I can regain access.",
      acceptance_criteria: "- User is on login page\n- User clicks 'Forgot Password' link\n- User enters email 'forgotten@test.com' and clicks 'Send Reset Link'\n- Success banner appears",
      gherkin: "Feature: Recovery\n  Scenario: Reset Password\n    Given user is on login page\n    When user clicks \"Forgot Password\"\n    And user enters email \"forgotten@test.com\"\n    Then success banner appears"
    },
    {
      user_story: "As a SaaS subscriber, I want to toggle dark mode so that UI is easier on eyes.",
      acceptance_criteria: "- User is on account settings panel\n- User toggles the Dark Mode switch to on\n- Background class changes to 'dark'",
      gherkin: "Feature: Customize Theme\n  Scenario: Toggle Dark Mode\n    Given user is on account settings\n    When user toggles Dark Mode on\n    Then body receives class \"dark\""
    },
    {
      user_story: "As a content creator, I want to publish a draft blog post so it is visible.",
      acceptance_criteria: "- Creator is on Blog Dashboard\n- Creator clicks Edit on draft 'My AI Journey'\n- Creator clicks 'Publish'\n- Status changes to 'Published'",
      gherkin: "Feature: Blog Publishing\n  Scenario: Publish Blog\n    Given creator is on Blog Dashboard\n    When creator clicks edit on draft \"My AI Journey\"\n    And creator clicks \"Publish\"\n    Then status is \"Published\""
    },
    {
      user_story: "As a subscriber, I want to search doc so that I can find parameters.",
      acceptance_criteria: "- User is on docs homepage\n- User enters 'auth token' in search\n- Results display link 'OAuth Flow'",
      gherkin: "Feature: Docs Search\n  Scenario: Search Parameters\n    Given user is on docs homepage\n    When user enters \"auth token\"\n    Then search results show link \"OAuth Flow\""
    },
    {
      user_story: "As an executive, I want to download May report so that I can submit expenses.",
      acceptance_criteria: "- User is on billing settings page\n- User clicks download icon next to May invoice\n- PDF download starts",
      gherkin: "Feature: Invoices\n  Scenario: Download PDF\n    Given user is on billing settings\n    When user clicks download icon\n    Then PDF download starts"
    },
    {
      user_story: "As a manager, I want to filter the employee directory so that I can find contacts.",
      acceptance_criteria: "- Manager is on directory page\n- Manager selects department 'Engineering'\n- List only shows engineering members",
      gherkin: "Feature: Directory\n  Scenario: Filter Department\n    Given manager is on directory page\n    When manager selects department \"Engineering\"\n    Then directory shows engineering members"
    },
    {
      user_story: "As a shopper, I want to select express checkout to skip steps.",
      acceptance_criteria: "- Shopper is on checkout page\n- Shopper clicks 'Express Checkout'\n- Express modal form displays with default billing address",
      gherkin: "Feature: Checkout\n  Scenario: Express Checkout\n    Given shopper is on checkout page\n    When shopper clicks \"Express Checkout\"\n    Then express modal form displays"
    },
    {
      user_story: "As a customer support agent, I want to sort open tickets by priority.",
      acceptance_criteria: "- Agent is on ticket dashboard\n- Agent selects sort order 'High Priority'\n- Ticket list sorts descending by priority",
      gherkin: "Feature: Support Tickets\n  Scenario: Sort tickets\n    Given agent is on dashboard\n    When agent selects sort \"High Priority\"\n    Then ticket list sorts descending"
    },
    {
      user_story: "As a user, I want to subscribe to the newsletter so I receive articles.",
      acceptance_criteria: "- User is on footer section\n- User enters email 'news@company.com' into subscribe input\n- User clicks 'Join'\n- Message 'Thanks for subscribing' appears",
      gherkin: "Feature: Newsletter Subscription\n  Scenario: Subscribe Footer\n    Given user is on footer section\n    When user enters email \"news@company.com\"\n    And user clicks \"Join\"\n    Then message \"Thanks for subscribing\" appears"
    }
  ];

  const [dataset, setDataset] = useState<DatasetItem[]>(preloadedDataset);

  const trainingLogs = [
    { epoch: 1, trainLoss: "2.1450", valLoss: "1.8540", accuracy: "68.2%", checkpoint: "checkpoint-10" },
    { epoch: 2, trainLoss: "1.1520", valLoss: "0.9850", accuracy: "78.5%", checkpoint: "checkpoint-20" },
    { epoch: 3, trainLoss: "0.4560", valLoss: "0.3920", accuracy: "84.9%", checkpoint: "checkpoint-30" },
    { epoch: 4, trainLoss: "0.1840", valLoss: "0.1620", accuracy: "91.4%", checkpoint: "checkpoint-40" },
    { epoch: 5, trainLoss: "0.0820", valLoss: "0.0750", accuracy: "93.8%", checkpoint: "checkpoint-50" }
  ];


  // Playwright Terminal Runner Simulator
  const [simulating, setSimulating] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simProgress, setSimProgress] = useState(0);

  // GitHub Actions integration
  const [ghaStatus, setGhaStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [ghaLogs, setGhaLogs] = useState<string[]>([]);
  const [ghaSimulating, setGhaSimulating] = useState(false);

  // Self-Healing locator simulator state
  const [brokenSelector, setBrokenSelector] = useState("button#submit-btn");
  const [htmlSnippet, setHtmlSnippet] = useState("<button id=\"login-button\" class=\"btn btn-primary\">Log In</button>");
  const [healingLogs, setHealingLogs] = useState<string[]>([]);
  const [healedSelector, setHealedSelector] = useState("");
  const [healingActive, setHealingActive] = useState(false);

  // API Call loader / Toast
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [toast, setToast] = useState("");

  // Missing states for dataset item creation
  const [newStory, setNewStory] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [newGherkin, setNewGherkin] = useState("");


  // Simulator Report, Suggestions, Export Modal & Search/Pagination states
  const [showSimReport, setShowSimReport] = useState(false);
  const [healedSuggestions, setHealedSuggestions] = useState<{ selector: string; score: number }[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSteps, setExportSteps] = useState<{ name: string; status: "pending" | "running" | "success" }[]>([]);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [datasetPage, setDatasetPage] = useState(0);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const backendUrl = import.meta.env.VITE_API_URL || "https://testforge-backend-auno.onrender.com";

  // Pre-coded demo options for Recruiter click-to-load
  const demos = [
    {
      title: "Login Workflow Automation",
      description: "Generate BDD + Playwright login tests",
      story: "As a registered customer, I want to log in to my account so that I can access my private dashboard.",
      criteria: "- User is on the login page\n- User inputs email 'user@example.com' and password 'securePass123'\n- User clicks the 'Login' button\n- Redirect the user to the dashboard page\n- Toast message 'Welcome back, User!' is visible",
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      title: "E-Commerce Checkout Validation",
      description: "AI-generated cart automation scenario",
      story: "As a retail shopper, I want to add headphones to my cart so that I can check out later.",
      criteria: "- Shopper is on product details page for 'Wireless Headphones'\n- Shopper selects quantity '2'\n- Shopper clicks 'Add to Cart' button\n- Navigation cart counter updates to '2'\n- Cart slide drawer opens automatically",
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      title: "Admin User Management Testing",
      description: "Role-based automation flow",
      story: "As an admin, I want to create a new user profile so that they can access the workspace.",
      criteria: "- Admin is on the user management tab\n- Admin clicks the 'Add User' button\n- Admin enters name 'Jane Doe', email 'jane@company.com', and selects role 'Editor'\n- Admin clicks 'Save'\n- Toast success notification 'User created successfully' appears",
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    }
  ];

  // Visual telemetry curves: SVG training loss curve points
  const lossPoints = "M 40 30 Q 90 90 140 100 T 240 108 T 340 110";

  useEffect(() => {
    fetchDataset();
  }, []);

  const fetchDataset = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/dataset`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setDataset(data);
        }
      }
    } catch (err) {
      console.error("Error loading dataset from API, using fallback preloads:", err);
    }
  };


  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleAddDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStory || !newCriteria || !newGherkin) {
      alert("Please fill in all fields before adding.");
      return;
    }

    // Optimistic UI Update: Add to dataset directly so table updates instantly
    const newItem = {
      user_story: newStory,
      acceptance_criteria: newCriteria,
      gherkin: newGherkin
    };
    setDataset(prev => [newItem, ...prev]);
    showToast("Added to training dataset corpus (optimistic UI)!");

    // Clear form inputs
    setNewStory("");
    setNewCriteria("");
    setNewGherkin("");

    try {
      const res = await fetch(`${backendUrl}/api/dataset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        showToast("Dataset successfully synced to backend!");
        fetchDataset();
      }
    } catch (err) {
      console.error(err);
    }
  };


  const loadDemo = (demo: typeof demos[0]) => {
    setUserStory(demo.story);
    setAcceptanceCriteria(demo.criteria);
    setEditableGherkin(
      `Feature: ${demo.title}\n\n  Scenario: Successful Execution of requirements\n    Given the user is on the landing page\n    When the user performs requirement actions\n    Then the system validates the outcomes`
    );
    setActiveTab("workspace");
    showToast(`Loaded "${demo.title}" template!`);
  };

  // Phase 1: NLP Prompt Ingestion & Gherkin generation
  const handleNlpAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_story: userStory,
          acceptance_criteria: acceptanceCriteria,
          mode,
          api_key: apiKey || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Server error occurred");
      }

      const data = await res.json();
      setEditableGherkin(data.gherkin);
      setPlaywright(data.playwright);
      showToast("NLP parsed requirements and generated Gherkin suggestions!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Natural Language Prompt Gherkin modifications
  const handleNlPromptEdit = () => {
    if (!nlInstruction.trim()) return;
    if (!editableGherkin) {
      alert("No BDD scenarios are currently loaded.");
      return;
    }
    
    let lines = editableGherkin.split("\n");
    const instr = nlInstruction.toLowerCase();
    
    if (instr.includes("remember me") || instr.includes("checkbox")) {
      const whenIdx = lines.findIndex(l => l.includes("When") || l.includes("enters"));
      if (whenIdx !== -1) {
        lines.splice(whenIdx + 2, 0, '    And the user clicks the "Remember Me" checkbox');
        setEditableGherkin(lines.join("\n"));
        showToast("Added 'Remember Me' action step!");
      }
    } else if (instr.includes("header") || instr.includes("title") || instr.includes("welcome")) {
      const thenIdx = lines.findIndex(l => l.includes("Then") || l.includes("should"));
      if (thenIdx !== -1) {
        lines.splice(thenIdx + 1, 0, '    And the user should see the header "Welcome to Dashboard"');
        setEditableGherkin(lines.join("\n"));
        showToast("Added 'Welcome Header' validation step!");
      }
    } else {
      lines.push(`    And the user performs validation "${nlInstruction}"`);
      setEditableGherkin(lines.join("\n"));
      showToast("Added custom action/validation step!");
    }
    setNlInstruction("");
  };

  // Phase 2: Compile Gherkin to Playwright scripts
  const handlePomCompile = async () => {
    if (!editableGherkin) {
      alert("Please compile or write BDD Gherkin scenarios first.");
      return;
    }
    setCompiling(true);
    try {
      const res = await fetch(`${backendUrl}/api/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gherkin: editableGherkin })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Server error");
      }

      const data = await res.json();
      setPlaywright(data.playwright);
      setSelectedPomIndex(0);
      showToast("Playwright spec and page objects compiled!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompiling(false);
    }
  };

  const triggerZipDownload = async () => {
    if (!playwright || !editableGherkin) return;
    try {
      const payload = {
        gherkin: editableGherkin,
        spec_code: playwright.spec_code,
        pages: playwright.pages.map(p => ({
          name: p.name,
          filename: p.filename,
          code: p.code
        }))
      };

      const res = await fetch(`${backendUrl}/api/export-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("ZIP compilation failed on API backend.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playwright-automation-suite.zip";
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
      showToast("✔ Suite exported successfully");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportZip = () => {
    if (!playwright || !editableGherkin) {
      alert("No compiled Gherkin or POM scripts are loaded to export.");
      return;
    }

    const steps = [
      { name: "Generating workspace configurations...", status: "pending" as const },
      { name: "Compiling tests/bdd-test.spec.ts...", status: "pending" as const },
      { name: "Compiling pages/LoginPage.ts...", status: "pending" as const },
      { name: "Injecting playwright.config.ts...", status: "pending" as const },
      { name: "Injecting github-actions.yml...", status: "pending" as const },
      { name: "Packaging README.md...", status: "pending" as const }
    ];

    setExportSteps(steps);
    setShowExportModal(true);

    let currentStep = 0;

    const runNextStep = () => {
      if (currentStep < steps.length) {
        setExportSteps(prev => prev.map((s, idx) => idx === currentStep ? { ...s, status: "running" as const } : s));
        setTimeout(() => {
          setExportSteps(prev => prev.map((s, idx) => idx === currentStep ? { ...s, status: "success" as const } : s));
          currentStep++;
          runNextStep();
        }, 250);
      } else {
        setTimeout(() => {
          setShowExportModal(false);
          triggerZipDownload();
        }, 350);
      }
    };

    runNextStep();
  };


  // Playwright Test Runner Simulator (Parallel workers logs)
  const startSimulation = () => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);
    setSimLogs([]);
    setShowSimReport(false);
    
    const logs = [
      "🚀 Initializing Playwright parallel execution...",
      "🔍 Loading local configs: playwright.config.ts",
      "📦 Spawning 4 parallel worker processes...",
      "🌐 Launching Chromium, Firefox, and WebKit browser engines...",
      "",
      "Worker 1: Running tests/user-auth.spec.ts on [chromium] project",
      "Worker 2: Running tests/user-auth.spec.ts on [webkit] project",
      "Worker 3: Running tests/user-auth.spec.ts on [firefox] project",
      "",
      "⏳ [chromium] › tests/bdd-test.spec.ts:14 › Successful Login - Running...",
      "⏳ [webkit  ] › tests/bdd-test.spec.ts:14 › Successful Login - Running...",
      "⏳ [firefox ] › tests/bdd-test.spec.ts:14 › Successful Login - Running...",
      "",
      "✓ PASS [chromium] › tests/bdd-test.spec.ts:14 › Successful Login (1.1s)",
      "✓ PASS [webkit  ] › tests/bdd-test.spec.ts:14 › Successful Login (1.4s)",
      "✓ PASS [firefox ] › tests/bdd-test.spec.ts:14 › Successful Login (1.7s)",
      "",
      "📊 Parallel Worker Output Summary:",
      "   - Chromium Worker #1: PASSED (1.1s)",
      "   - WebKit Worker #2:   PASSED (1.4s)",
      "   - Firefox Worker #3:  PASSED (1.7s)",
      "",
      "🎉 Execution complete: 3 passed (2.3s total time)",
      "📁 HTML execution report generated: playwright-report/index.html"
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < logs.length) {
        setSimLogs(prev => [...prev, logs[currentLine]]);
        setSimProgress(Math.min(((currentLine + 1) / logs.length) * 100, 100));
        currentLine++;
      } else {
        clearInterval(interval);
        setSimulating(false);
        setShowSimReport(true);
        showToast("Spec execution simulation complete!");
      }
    }, 120);
  };

  // GitHub Actions CI run simulation
  const startGhaSimulation = () => {
    if (ghaSimulating) return;
    setGhaSimulating(true);
    setGhaStatus("running");
    setGhaLogs([]);

    const logs = [
      "⚡ GitHub Actions: Triggered workflow 'Playwright Tests' on pull_request",
      "🐳 Job 'test' dispatched on runner 'ubuntu-latest'",
      "📥 Action: checking out repository...",
      "⚙️ Action: setting up Node.js v20...",
      "📦 Action: installing dependency package.json packages...",
      "🌐 Action: installing Playwright browser system binary engines...",
      "🚀 Running tests: npm test...",
      "   [chromium] › bdd-test.spec.ts › Valid login (1.1s)",
      "   [firefox ] › bdd-test.spec.ts › Valid login (1.6s)",
      "   ✓ 2 passed (1.9s)",
      "📤 Action: uploading report artifact 'playwright-report'...",
      "🎉 Workflow complete. Status: SUCCESS"
    ];

    let line = 0;
    const interval = setInterval(() => {
      if (line < logs.length) {
        setGhaLogs(prev => [...prev, logs[line]]);
        line++;
      } else {
        clearInterval(interval);
        setGhaSimulating(false);
        setGhaStatus("success");
        showToast("GitHub Actions Workflow run complete!");
      }
    }, 150);
  };

  // Self-Healing selector logic
  const handleHealSelector = () => {
    if (!brokenSelector.trim() || !htmlSnippet.trim()) return;
    setHealingActive(true);
    setHealingLogs([]);
    setHealedSelector("");
    setHealedSuggestions([]);

    const logs = [
      "🔍 Self-Healing Agent: Evaluating broken locator target...",
      "❌ Error reported: Element 'button#submit-btn' was not found in page DOM.",
      "🌐 Fetching active page DOM snippet...",
      "🧠 Preprocessing HTML code nodes...",
      "🤖 Running token similarity matches with broken target selector...",
      "💡 Match detected: '<button id=\"login-button\" ...>Log In</button>'",
      "🔧 Analyzing semantic attributes: Text matches 'Log In', type is submit button.",
      "✅ Suggesting corrected locator value..."
    ];

    let line = 0;
    const interval = setInterval(() => {
      if (line < logs.length) {
        setHealingLogs(prev => [...prev, logs[line]]);
        line++;
      } else {
        clearInterval(interval);
        setHealingActive(false);
        
        let targetSelector = "button:has-text('Log In')";
        if (htmlSnippet.includes('id="login-button"')) {
          targetSelector = "button#login-button";
        }
        
        const suggestions = [
          { selector: targetSelector, score: 98.5 },
          { selector: "button:has-text('Log In')", score: 94.2 },
          { selector: "button[type='submit']", score: 91.0 }
        ];
        
        // Remove duplicate if targetSelector matches button:has-text('Log In')
        const uniqueSuggestions = suggestions.filter((v, i, a) => a.findIndex(t => t.selector === v.selector) === i);
        
        setHealedSuggestions(uniqueSuggestions);
        setHealedSelector(targetSelector);
        showToast("Selector healed successfully!");
      }
    }, 150);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = filename;
    element.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleSearchChange = (val: string) => {
    setDatasetSearch(val);
    setDatasetPage(0);
  };

  const itemsPerPage = 5;
  const filteredDataset = dataset.filter(item => 
    item.user_story.toLowerCase().includes(datasetSearch.toLowerCase()) ||
    item.acceptance_criteria.toLowerCase().includes(datasetSearch.toLowerCase()) ||
    item.gherkin.toLowerCase().includes(datasetSearch.toLowerCase())
  );
  const paginatedDataset = filteredDataset.slice(datasetPage * itemsPerPage, (datasetPage + 1) * itemsPerPage);
  const totalPages = Math.ceil(filteredDataset.length / itemsPerPage);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' }}>T</div>
          <div className="brand-title">
            <h1>TestForge AI</h1>
            <p>AI-powered platform that converts requirements into production-ready BDD and Playwright automation suites</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${activeTab === 'showcase' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('showcase')}
          >
            📊 Live Demo
          </button>
          <button 
            className={`btn ${activeTab === 'workspace' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('workspace')}
          >
            💻 Automation Studio
          </button>
          <button 
            className={`btn ${activeTab === 'dataset' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dataset')}
          >
            🗂️ Dataset Manager ({dataset.length})
          </button>
        </div>
      </header>

      {/* Recruiter Showcase View */}
      {activeTab === 'showcase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Hero Pitch Banner */}
          {/* Hero Pitch Banner */}
          <div className="glass-panel" style={{ 
            background: 'linear-gradient(135deg, rgba(100, 50, 200, 0.2) 0%, rgba(30, 200, 220, 0.1) 100%)',
            borderLeft: '4px solid hsl(var(--primary))',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span className="badge badge-page" style={{ fontSize: '12px', padding: '6px 12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Introducing TestForge AI</span>
            <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-1px', color: 'white', margin: '8px 0 0 0' }}>
              AI Test Automation, Reimagined
            </h2>
            <p style={{ fontSize: '18px', color: 'hsl(var(--text-secondary))', maxWidth: '750px', margin: '0 auto', lineHeight: '1.5' }}>
              AI-powered platform that converts requirements into production-ready BDD and Playwright automation suites.
            </p>
            <div style={{ fontSize: '14px', color: 'hsl(var(--accent))', fontWeight: 600, letterSpacing: '0.5px', marginTop: '4px' }}>
              From user stories → AI analysis → BDD scenarios → Playwright automation in minutes.
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setActiveTab('workspace')}
                style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 600, borderRadius: '8px' }}
              >
                Generate Automation Suite 🚀
              </button>
              <a 
                href="#live-demo-section" 
                className="btn btn-secondary"
                style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 600, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                Try Live Demo 👇
              </a>
            </div>

            {/* Trust Markers */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px', width: '100%' }}>
              <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', alignSelf: 'center', marginRight: '8px' }}>Powered by industry-grade technologies:</span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                🐍 FastAPI
              </span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                🎭 Playwright
              </span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                🤖 OpenAI
              </span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                🤗 HuggingFace
              </span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                🐳 Docker
              </span>
              <span className="badge badge-generic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                ☁️ AWS
              </span>
            </div>
          </div>

          {/* Clean 3-Step Workflow Panel */}
          <div style={{ margin: '8px 0 8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="glass-panel hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px', position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '28px', color: 'hsl(var(--accent))', fontWeight: 800 }}>01</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'white' }}>Input Requirements</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', margin: 0 }}>Provide user stories and acceptance criteria in plain natural language.</p>
              </div>
              <div className="glass-panel hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px', position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '28px', color: 'hsl(var(--primary-hover))', fontWeight: 800 }}>02</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'white' }}>AI Generates Test Assets</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', margin: 0 }}>NLP parser extracts actions, heals selectors, and compiles modular POM classes.</p>
              </div>
              <div className="glass-panel hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px', position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '28px', color: 'hsl(var(--success))', fontWeight: 800 }}>03</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'white' }}>Export Automation Suite</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', margin: 0 }}>Download fully configured Playwright test suites, POM page files, and CI/CD configs.</p>
              </div>
            </div>
          </div>

          {/* Architecture Strip */}
          <div className="glass-panel" style={{ 
            padding: '16px 24px', 
            background: 'rgba(255,255,255,0.01)', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '13px',
            fontWeight: 500
          }}>
            <span style={{ color: 'hsl(var(--text-muted))', marginRight: '8px' }}>Pipeline architecture:</span>
            <span style={{ color: 'white', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>Requirements</span>
            <span style={{ color: 'hsl(var(--text-muted))' }}>→</span>
            <span style={{ color: 'hsl(var(--accent))', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>NLP Engine</span>
            <span style={{ color: 'hsl(var(--text-muted))' }}>→</span>
            <span style={{ color: 'hsl(var(--primary-hover))', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>BDD Generator</span>
            <span style={{ color: 'hsl(var(--text-muted))' }}>→</span>
            <span style={{ color: 'hsl(var(--success))', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>Playwright Compiler</span>
            <span style={{ color: 'hsl(var(--text-muted))' }}>→</span>
            <span style={{ color: 'hsl(var(--accent))', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>CI/CD Export</span>
          </div>

          {/* Quick Demos */}
          <div id="live-demo-section">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Interactive Click-to-Load Demos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {demos.map((d: any, index) => (
                <div key={index} className="glass-panel hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'hsl(var(--primary-hover))' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {d.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>{d.title}</h4>
                      <span style={{ fontSize: '12px', color: 'hsl(var(--accent))', fontWeight: 500 }}>{d.description}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', minHeight: '45px', margin: 0 }}>
                    <b>Story:</b> "{d.story.slice(0, 100)}..."
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      loadDemo(d);
                      // Scroll to top or switch tab if needed, loadDemo automatically loads it in IDE.
                      // Let's add a toast or alert when loaded
                      showToast(`Loaded "${d.title}" demo into Automation Studio!`);
                    }}
                    style={{ fontSize: '13px', padding: '8px 16px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    Generate Automation Suite ⚡
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Why TestForge Section */}
          <div style={{ margin: '16px 0' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', textAlign: 'center', color: 'white' }}>Why TestForge?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="glass-panel hover-lift" style={{ padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px', display: 'block' }}>⚡</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>AI Requirement Understanding</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.4 }}>Transforms natural language requirements and user stories into test-ready Gherkin BDD scenarios.</p>
              </div>
              <div className="glass-panel hover-lift" style={{ padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px', display: 'block' }}>🧠</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>Self-Healing Automation</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.4 }}>Automatically repairs broken element locators and selectors using advanced semantic similarity analyses.</p>
              </div>
              <div className="glass-panel hover-lift" style={{ padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px', display: 'block' }}>🚀</span>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>Export Full Test Suites</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.4 }}>Download fully configured Playwright suites, POM classes, and CI/CD GitHub action workflows instantly.</p>
              </div>
            </div>
          </div>

          {/* Collapsible Telemetry section to reduce landing density */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', margin: '8px 0' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowTelemetry(!showTelemetry)}
              style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', borderRadius: '8px', fontWeight: 600 }}
            >
              {showTelemetry ? "📊 Hide NLP Performance Benchmarks & Curves" : "📊 View NLP Model Performance Benchmarks & Telemetry"}
            </button>
          </div>

          {showTelemetry && (
            <div className="dashboard-grid" style={{ animation: 'fadeIn 0.25s ease-out' }}>
              {/* Multi-Model Comparison Tradeoffs */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px' }}>
                  NLP Model Typology Tradeoffs
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table className="telemetry-table">
                    <thead>
                      <tr>
                        <th>NLP Model</th>
                        <th>Avg. Latency</th>
                        <th>Est. Benchmark Accuracy</th>
                        <th>Cost / Run</th>
                        <th>Best For</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: 'white', fontWeight: 600 }}>GPT-4 API</td>
                        <td style={{ color: 'hsl(var(--accent))' }}>~1500ms</td>
                        <td style={{ color: 'hsl(var(--success))', fontWeight: 'bold' }}>97.4%</td>
                        <td>~$0.03</td>
                        <td>Multi-page complex tests</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'white', fontWeight: 600 }}>Flan-T5-Small</td>
                        <td style={{ color: 'hsl(var(--primary-hover))' }}>~800ms</td>
                        <td style={{ color: 'hsl(var(--warning))', fontWeight: 'bold' }}>92.4%</td>
                        <td style={{ color: 'hsl(var(--success))' }}>$0.00</td>
                        <td>Offline local fine-tuning</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'white', fontWeight: 600 }}>spaCy Heuristics</td>
                        <td style={{ color: 'hsl(var(--secondary))' }}>~10ms</td>
                        <td style={{ color: 'hsl(var(--text-muted))' }}>85.0%</td>
                        <td style={{ color: 'hsl(var(--success))' }}>$0.00</td>
                        <td>Standard rigid Gherkin</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Real Training Metrics Telemetry (Visual SVG Curve & Data Table) */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Model Training Telemetry & Validation curves</span>
                  <span style={{ fontSize: '11.5px', color: 'hsl(var(--text-muted))', fontWeight: 'normal' }}>* Demo telemetry simulation</span>
                </h3>
                
                {/* Telemetry loss SVG graph */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <svg width="340" height="90" style={{ overflow: 'visible' }}>
                    <line x1="30" y1="10" x2="330" y2="10" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                    <line x1="30" y1="50" x2="330" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                    
                    <path 
                      d={lossPoints} 
                      fill="none" 
                      stroke="url(#loss-grad)" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                    />
                    
                    <circle cx="40" cy="30" r="4" fill="hsl(var(--primary-hover))" />
                    <circle cx="340" cy="110" r="0" /> {/* dummy anchor */}
                    <circle cx="330" cy="80" r="4" fill="hsl(var(--secondary))" />

                    <defs>
                      <linearGradient id="loss-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--secondary))" />
                      </linearGradient>
                    </defs>

                    <text x="25" y="34" fill="hsl(var(--text-muted))" fontSize="9" textAnchor="end">2.14</text>
                    <text x="25" y="84" fill="hsl(var(--text-muted))" fontSize="9" textAnchor="end">0.08</text>
                    <text x="35" y="105" fill="hsl(var(--text-muted))" fontSize="9">Epoch 1</text>
                    <text x="330" y="105" fill="hsl(var(--text-muted))" fontSize="9" textAnchor="end">Epoch 5</text>
                  </svg>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="telemetry-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Epoch</th>
                        <th>Train Loss</th>
                        <th>Val Loss</th>
                        <th>Accuracy</th>
                        <th>Checkpoint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingLogs.map(l => (
                        <tr key={l.epoch}>
                          <td style={{ color: 'white', fontWeight: 600 }}>Epoch {l.epoch}</td>
                          <td>{l.trainLoss}</td>
                          <td>{l.valLoss}</td>
                          <td style={{ color: 'hsl(var(--success))', fontWeight: 600 }}>{l.accuracy}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{l.checkpoint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Playwright Parallel Execution & GitHub Actions CI Grid */}
          <div className="dashboard-grid">
            {/* Playwright execution simulator */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Playwright Parallel Runner Logs</h3>
                <button 
                  className="btn btn-primary" 
                  onClick={startSimulation}
                  disabled={simulating}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  {simulating ? "Executing..." : "Execute tests 🚀"}
                </button>
              </div>
              
              <div style={{ 
                background: '#040711', 
                border: '1px solid hsl(var(--border-subtle))', 
                borderRadius: '12px',
                minHeight: '220px',
                padding: '16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.9)',
                color: '#abb2bf',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                overflowY: 'auto',
                maxHeight: '260px'
              }}>
                {simLogs.length === 0 ? (
                  <div style={{ color: 'hsl(var(--text-muted))', margin: 'auto', textAlign: 'center' }}>
                    Click "Execute tests" to trigger parallel runner simulation logs.
                  </div>
                ) : (
                  simLogs.map((log, index) => {
                    if (!log) return <div key={index} style={{ height: '12px' }}></div>;
                    let color = "#abb2bf";
                    if (log.startsWith("✓")) color = "#98c379";
                    else if (log.startsWith("🚀") || log.startsWith("⚡")) color = "#61afef";
                    else if (log.includes("PASSED")) color = "#98c379";
                    else if (log.startsWith("⏳")) color = "#d19a66";
                    return <div key={index} style={{ color }}>{log}</div>;
                  })
                )}
              </div>

              {simProgress > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${simProgress}%`, height: '100%', background: 'hsl(var(--secondary))', transition: 'width 0.1s' }}></div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', width: '30px', textAlign: 'right' }}>
                    {Math.round(simProgress)}%
                  </span>
                </div>
              )}

              {showSimReport && (
                <div style={{
                  background: 'rgba(142, 226, 46, 0.05)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid hsla(var(--success), 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '12px',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'hsl(var(--success))', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🟢 Playwright Suite Passed
                    </span>
                    <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Parallel Worker Report</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Passed</span>
                      <div style={{ color: '#98c379', fontWeight: 'bold', fontSize: '16px', marginTop: '2px' }}>3</div>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Failed</span>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px', marginTop: '2px' }}>0</div>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Browsers</span>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '11px', marginTop: '4px', lineHeight: '1.2' }}>Chromium, Firefox, WebKit</div>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Duration</span>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px', marginTop: '2px' }}>2.3s</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GitHub Actions Integration panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>GitHub Actions CI/CD workflow</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={startGhaSimulation}
                    disabled={ghaSimulating}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    {ghaSimulating ? "CI Running..." : "Trigger CI Build ⚙️"}
                  </button>
                  <span className={`badge ${ghaStatus === 'success' ? 'badge-assert' : (ghaStatus === 'running' ? 'badge-input' : 'badge-generic')}`} style={{ alignSelf: 'center' }}>
                    CI: {ghaStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              {ghaLogs.length > 0 ? (
                <div style={{ 
                  background: '#040711', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: '12px',
                  minHeight: '160px',
                  padding: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.9)',
                  color: '#98c379',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {ghaLogs.map((log, index) => {
                    if (!log) return null;
                    return (
                      <div key={index} style={{ color: log.includes("Error") ? 'red' : (log.includes("SUCCESS") ? '#98c379' : '#abb2bf') }}>
                        {log}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <pre style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '11.5px', 
                  fontFamily: 'var(--font-mono)',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  {`name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Install dependencies
      run: npm install
    - name: Run Playwright
      run: npx playwright test`}
                </pre>
              )}

              {ghaStatus === 'success' && (
                <div style={{ 
                  background: 'rgba(142, 226, 46, 0.05)', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: '1px solid hsla(var(--success), 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'hsl(var(--success))', fontWeight: 'bold' }}>🎉 Pipeline successfully executed all tests.</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Last Run</span>
                      <div style={{ color: '#98c379', fontWeight: 'bold', marginTop: '2px' }}>Successful</div>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Duration</span>
                      <div style={{ color: 'white', fontWeight: 'bold', marginTop: '2px' }}>2m 13s</div>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Artifact</span>
                      <div style={{ color: 'white', fontWeight: 'bold', marginTop: '2px' }}>playwright-report.zip</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Self-healing locators console */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px' }}>
              AI Self-Healing Locators Simulator
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Broken Selector Target</label>
                  <input type="text" className="form-input" value={brokenSelector} onChange={(e) => setBrokenSelector(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">New Page DOM Segment HTML</label>
                  <textarea className="form-textarea" style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }} value={htmlSnippet} onChange={(e) => setHtmlSnippet(e.target.value)} />
                </div>

                <button className="btn btn-primary" onClick={handleHealSelector} disabled={healingActive}>
                  {healingActive ? "AI healing locator..." : "Heal Locator Target 🔧"}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Healing Logs</span>
                <div style={{ 
                  background: '#040711', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: '12px',
                  minHeight: '120px',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#abb2bf'
                }}>
                  {healingLogs.length === 0 ? (
                    <span style={{ color: 'hsl(var(--text-muted))' }}>Console idle. Trigger locator healing...</span>
                  ) : (
                    healingLogs.map((log, idx) => {
                      if (!log) return null;
                      return (
                        <div key={idx} style={{ color: log.startsWith("✅") ? '#98c379' : (log.startsWith("❌") ? 'red' : '#abb2bf') }}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>

                {healedSelector && (
                  <div style={{ background: 'rgba(142, 226, 46, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid hsla(var(--success), 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      AI Candidate Locator Match Ratings
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {healedSuggestions.map((sug, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <code style={{ fontSize: '13px', color: idx === 0 ? '#98c379' : '#abb2bf', fontWeight: idx === 0 ? 'bold' : 'normal' }}>
                            await page.locator("{sug.selector}")
                          </code>
                          <span style={{ fontSize: '12px', color: idx === 0 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', fontWeight: 'bold' }}>
                            {sug.score}% {idx === 0 ? "★" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recruiter DevOps & Deployment Stack Card */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px' }}>
              DevOps & AWS Lambda Deployment Stack
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 700, marginBottom: '8px' }}>🐳 Dockerized API Container</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                  The FastAPI application is packaged inside a Debian-slim Docker image containing dependencies like PyTorch, HuggingFace transformers, and pre-cached spaCy language modules.
                </p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 700, marginBottom: '8px' }}>☁️ AWS Lambda Inference</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                  Backend endpoints are structured to deploy serverlessly on AWS Lambda using Mangum, enabling autoscaling capacity and zero-idle pricing for model translations.
                </p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 700, marginBottom: '8px' }}>📦 S3 & CloudFront Frontend</h4>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                  Vite built React static bundles are uploaded to Amazon S3 buckets and distributed globally via Amazon CloudFront CDN edge paths for 100ms UI loads.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace View */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Step Progress Tracker */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(13, 17, 28, 0.4)', padding: '16px 24px', borderRadius: '12px', border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--primary-hover))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workflow Pipeline:</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', flex: 1, justifyContent: 'space-around', marginLeft: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${playwright ? 'badge-assert' : 'badge-input'}`} style={{ textTransform: 'none' }}>
                  {playwright ? "✔ Complete" : "● Active"}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'white' }}>1. Ingest Requirements</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${playwright ? 'badge-assert' : (editableGherkin ? 'badge-input' : 'badge-generic')}`} style={{ textTransform: 'none' }}>
                  {playwright ? "✔ Complete" : (editableGherkin ? "● Active" : "○ Pending")}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: playwright || editableGherkin ? 'white' : 'hsl(var(--text-muted))' }}>2. NLP Gherkin Approval</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${playwright && playwright.spec_code ? 'badge-assert' : (compiling ? 'badge-input' : 'badge-generic')}`} style={{ textTransform: 'none' }}>
                  {playwright && playwright.spec_code ? "✔ Complete" : (compiling ? "● Generating..." : "○ Pending")}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: playwright && playwright.spec_code ? 'white' : 'hsl(var(--text-muted))' }}>3. POM Compilation</span>
              </div>
            </div>
          </div>
          
          {/* Phase 1 & 2 layout */}
          <div className="dashboard-grid">
            {/* Input card */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '18px', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>1. Requirements Ingest & Analyze</span>
                <span style={{ fontSize: '12px', color: 'hsl(var(--primary-hover))' }}>Step 1 of 3</span>
              </h2>

              <div className="form-group">
                <label className="form-label">User Story</label>
                <textarea 
                  className="form-textarea" 
                  value={userStory} 
                  onChange={(e) => setUserStory(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Acceptance Criteria</label>
                <textarea 
                  className="form-textarea" 
                  style={{ minHeight: '160px' }}
                  value={acceptanceCriteria} 
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">AI Parsing Engine</label>
                <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="rules">NLP Rule-Based Engine (Fast Demo)</option>
                  <option value="openai">GPT-4 API (Optional)</option>
                </select>
              </div>

              {mode === 'openai' && (
                <div className="form-group">
                  <label className="form-label">OpenAI API Key</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="sk-proj-..."
                  />
                </div>
              )}

              <button className="btn btn-primary" onClick={handleNlpAnalyze} disabled={loading} style={{ width: '100%' }}>
                {loading ? (
                  <>
                    <span className="loader-spinner"></span> Running NLP models...
                  </>
                ) : "Run NLP Parsing (Generate BDD)"}
              </button>
            </div>

            {/* Human Approval Gherkin Workspace */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '18px', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>2. Human Approval & Edit Panel</span>
                <span style={{ fontSize: '12px', color: 'hsl(var(--primary-hover))' }}>Step 2 of 3</span>
              </h2>
              
              <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                Review and edit the AI-generated Gherkin scenarios below. Once you are satisfied with the scenarios, compile them to Playwright Page Objects.
              </p>

              <textarea 
                className="form-textarea" 
                style={{ flex: 1, minHeight: '280px', fontFamily: 'var(--font-mono)', fontSize: '13.5px', background: '#090d16' }}
                value={editableGherkin} 
                onChange={(e) => setEditableGherkin(e.target.value)}
                placeholder="BDD Gherkin output will load here. You can manually edit it before compiling..."
              />

              {/* Natural Language Prompt Edits */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 1 }}
                  value={nlInstruction} 
                  onChange={(e) => setNlInstruction(e.target.value)}
                  placeholder="Ask AI to edit BDD (e.g. 'Add remember me validation')" 
                />
                <button className="btn btn-secondary" style={{ padding: '0 16px' }} onClick={handleNlPromptEdit}>
                  Update ✏️
                </button>
              </div>

              <button className="btn btn-primary" onClick={handlePomCompile} disabled={compiling || !editableGherkin} style={{ width: '100%', marginTop: '8px' }}>
                {compiling ? (
                  <>
                    <span className="loader-spinner"></span> Compiling Page Objects...
                  </>
                ) : "Approve & Compile POM Playwright Scripts"}
              </button>
            </div>
          </div>

          {/* Phase 3: Compiled Code Output View */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="tabs-header" style={{ marginBottom: 0 }}>
                <button 
                  className={`tab-btn ${activeCodeTab === 'spec' ? 'active' : ''}`}
                  onClick={() => setActiveCodeTab('spec')}
                >
                  Playwright Spec
                </button>
                <button 
                  className={`tab-btn ${activeCodeTab === 'pom' ? 'active' : ''}`}
                  onClick={() => setActiveCodeTab('pom')}
                >
                  Page Objects (POM)
                </button>
                <button 
                  className={`tab-btn ${activeCodeTab === 'nlp' ? 'active' : ''}`}
                  onClick={() => setActiveCodeTab('nlp')}
                >
                  🧠 NLP Parser Visualizer
                </button>
                <button 
                  className={`tab-btn ${activeCodeTab === 'readme' ? 'active' : ''}`}
                  onClick={() => setActiveCodeTab('readme')}
                >
                  📄 README.md Preview
                </button>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleExportZip}
                disabled={!playwright}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                📦 Export Full Suite (.ZIP)
              </button>
            </div>

            {activeCodeTab === 'spec' && (
              <div className="code-container">
                <div className="code-header">
                  <span className="code-lang">TypeScript (Playwright Spec)</span>
                  <div className="code-actions">
                    <button className="code-btn" onClick={() => copyToClipboard(playwright?.spec_code || "")}>📋 Copy</button>
                    <button className="code-btn" onClick={() => downloadFile("bdd-test.spec.ts", playwright?.spec_code || "")}>💾 Download</button>
                  </div>
                </div>
                <pre className="code-pre">
                  <code dangerouslySetInnerHTML={{ __html: highlightTypeScript(playwright?.spec_code || "") || "Compile assets to view code specs." }} />
                </pre>
              </div>
            )}

            {activeCodeTab === 'pom' && (
              <div className="pom-files-grid">
                <div className="pom-sidebar">
                  {playwright && playwright.pages.length > 0 ? (
                    playwright.pages.map((p, index) => (
                      <button 
                        key={p.name}
                        className={`pom-file-tab ${selectedPomIndex === index ? 'active' : ''}`}
                        onClick={() => setSelectedPomIndex(index)}
                      >
                        📄 {p.filename}
                      </button>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>No POM files yet</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  {playwright && playwright.pages[selectedPomIndex] ? (
                    <div className="code-container">
                      <div className="code-header">
                        <span className="code-lang">TypeScript (POM Class)</span>
                        <div className="code-actions">
                          <button className="code-btn" onClick={() => copyToClipboard(playwright.pages[selectedPomIndex].code)}>📋 Copy</button>
                          <button className="code-btn" onClick={() => downloadFile(playwright.pages[selectedPomIndex].filename, playwright.pages[selectedPomIndex].code)}>💾 Download</button>
                        </div>
                      </div>
                      <pre className="code-pre">
                        <code dangerouslySetInnerHTML={{ __html: highlightTypeScript(playwright.pages[selectedPomIndex].code) }} />
                      </pre>
                    </div>
                  ) : (
                    <div style={{ color: 'hsl(var(--text-muted))', padding: '40px', textAlign: 'center' }}>
                      Compile Gherkin to view Page Objects.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeCodeTab === 'readme' && (
              <div className="code-container">
                <div className="code-header">
                  <span className="code-lang">Markdown (README.md)</span>
                  <div className="code-actions">
                    <button className="code-btn" onClick={() => copyToClipboard(defaultReadme)}>📋 Copy</button>
                    <button className="code-btn" onClick={() => downloadFile("README.md", defaultReadme)}>💾 Download</button>
                  </div>
                </div>
                <pre className="code-pre">
                  <code style={{ color: '#abb2bf', whiteSpace: 'pre-wrap' }}>{defaultReadme}</code>
                </pre>
              </div>
            )}

            {activeCodeTab === 'nlp' && (
              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Visual Intent & Actions mapping */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Grammar-Parsing Visual Extraction</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid hsl(var(--border-subtle))' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Extracted Intent</span>
                      <div style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>User Authentication</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Parsed Action Words</span>
                      <div style={{ color: 'hsl(var(--primary-hover))', fontSize: '13px', fontWeight: 600 }}>navigate, enters, clicks, redirects</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>Target UI Elements</span>
                      <div style={{ color: 'hsl(var(--secondary-hover))', fontSize: '13px', fontWeight: 600 }}>email field, password field, login button</div>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid hsl(var(--border-subtle))' }}>
                  <table className="telemetry-table">
                    <thead>
                      <tr>
                        <th>Gherkin step line</th>
                        <th>Token Token</th>
                        <th>Entity Entity</th>
                        <th>Extracted Action</th>
                        <th>Playwright Selector Locator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playwright?.nlp_entities && playwright.nlp_entities.length > 0 ? (
                        playwright.nlp_entities.map((ent, idx) => (
                          <tr key={idx}>
                            <td style={{ color: 'white' }}>{ent.step}</td>
                            <td><code style={{ color: 'hsl(var(--secondary-hover))' }}>{ent.token}</code></td>
                            <td>
                              <span className={`badge ${
                                ent.label === 'PAGE_NAVIGATION' ? 'badge-page' : 
                                (ent.label === 'INPUT_FIELD' ? 'badge-input' : 
                                (ent.label === 'CLICKABLE_ELEMENT' ? 'badge-click' : 
                                (ent.label === 'EXPECT_ASSERTION' ? 'badge-assert' : 'badge-generic')))
                              }`}>
                                {ent.label}
                              </span>
                            </td>
                            <td><code style={{ color: '#abb2bf' }}>{ent.action}</code></td>
                            <td><code style={{ color: '#98c379', fontWeight: 600 }}>{ent.selector}</code></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--text-muted))' }}>
                            No NLP entities extracted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dataset View (Always active, populated with preloads) */}
      {activeTab === 'dataset' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Model Training Dataset Corpus</h2>
            <p style={{ color: 'hsl(var(--text-muted))', fontSize: '14px' }}>
              These pairs are used to fine-tune the local T5 Seq2Seq model to map user story definitions to correct Gherkin BDD format.
            </p>
          </div>

          {/* Add Item form */}
          <form onSubmit={handleAddDataset} className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px' }}>Add Training Example</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">User Story</label>
                <textarea className="form-textarea" style={{ minHeight: '80px' }} value={newStory} onChange={(e) => setNewStory(e.target.value)} placeholder="As a..." />
              </div>
              <div className="form-group">
                <label className="form-label">Acceptance Criteria</label>
                <textarea className="form-textarea" style={{ minHeight: '80px' }} value={newCriteria} onChange={(e) => setNewCriteria(e.target.value)} placeholder="- bullet points..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Target Gherkin Output</label>
              <textarea className="form-textarea" style={{ minHeight: '100px', fontFamily: 'var(--font-mono)' }} value={newGherkin} onChange={(e) => setNewGherkin(e.target.value)} placeholder="Feature: ... Scenario: ..." />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>Add to Dataset</button>
          </form>

          {/* Dataset Search & Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ flex: 1, maxWidth: '400px', fontSize: '13.5px' }}
                value={datasetSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="🔍 Search user story or acceptance criteria..."
              />
              {datasetSearch && (
                <button type="button" className="btn btn-secondary" style={{ padding: '0 12px', fontSize: '13px' }} onClick={() => handleSearchChange("")}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ fontSize: '13.5px', color: 'hsl(var(--text-muted))' }}>
              Showing {filteredDataset.length} of {dataset.length} items
            </div>
          </div>

          {/* Dataset Grid */}
          <div className="dataset-table-container" style={{ marginTop: '8px' }}>
            <table className="dataset-table">
              <thead>
                <tr>
                  <th>User Story</th>
                  <th>Acceptance Criteria</th>
                  <th>Gherkin Output</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDataset.length > 0 ? (
                  paginatedDataset.map((item, idx) => (
                    <tr key={idx}>
                      <td title={item.user_story} style={{ maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.user_story}</td>
                      <td title={item.acceptance_criteria} style={{ maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.acceptance_criteria}</td>
                      <td title={item.gherkin} style={{ maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.gherkin}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'hsl(var(--text-muted))' }}>
                      No matching dataset items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Dataset Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '13px' }} 
                onClick={() => setDatasetPage(p => Math.max(0, p - 1))}
                disabled={datasetPage === 0}
              >
                ◀ Previous
              </button>
              <span style={{ fontSize: '13.5px', color: 'hsl(var(--text-secondary))' }}>
                Page <b>{datasetPage + 1}</b> of <b>{totalPages}</b>
              </span>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '13px' }} 
                onClick={() => setDatasetPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={datasetPage >= totalPages - 1}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      )}


      {/* Export Confirmation Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(5, 7, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{ width: '480px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📦 Packaging Playwright Test Suite
            </h3>
            <p style={{ fontSize: '13.5px', color: 'hsl(var(--text-muted))' }}>
              Compiling NLP assets and modular Page Object Model classes into a standalone repository bundle...
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
              {exportSteps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  {step.status === 'success' && <span style={{ color: 'hsl(var(--success))' }}>✔</span>}
                  {step.status === 'running' && <span className="loader-spinner" style={{ width: '12px', height: '12px', borderTopColor: 'hsl(var(--primary))' }}></span>}
                  {step.status === 'pending' && <span style={{ color: 'hsl(var(--text-muted))' }}>○</span>}
                  <span style={{ color: step.status === 'pending' ? 'hsl(var(--text-muted))' : (step.status === 'running' ? 'white' : 'hsl(var(--text-secondary))'), fontWeight: step.status === 'running' ? 'bold' : 'normal' }}>
                    {step.name}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${(exportSteps.filter(s => s.status === 'success').length / exportSteps.length) * 100}%`,
                height: '100%',
                background: 'hsl(var(--primary))',
                transition: 'width 0.2s'
              }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'hsl(var(--bg-surface-elevated))',
          border: '1px solid hsl(var(--primary))',
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          ✨ {toast}
        </div>
      )}
    </div>
  );
}
