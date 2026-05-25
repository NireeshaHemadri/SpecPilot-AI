import os
import json

try:
    import torch
    from transformers import (
        AutoTokenizer, 
        AutoModelForSeq2SeqLM, 
        Seq2SeqTrainingArguments, 
        Seq2SeqTrainer,
        DataCollatorForSeq2Seq
    )
    HAS_ML_DEPS = True
except ImportError:
    torch = None
    AutoTokenizer = None
    AutoModelForSeq2SeqLM = None
    Seq2SeqTrainingArguments = None
    Seq2SeqTrainer = None
    DataCollatorForSeq2Seq = None
    HAS_ML_DEPS = False

DatasetClass = torch.utils.data.Dataset if HAS_ML_DEPS else object

class UserStoryDataset(DatasetClass):
    def __init__(self, data, tokenizer, max_input_length=512, max_target_length=512):
        self.data = data
        self.tokenizer = tokenizer
        self.max_input_length = max_input_length
        self.max_target_length = max_target_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        user_story = item["user_story"]
        ac = item["acceptance_criteria"]
        target = item["gherkin"]

        # Format input string
        input_text = f"generate gherkin bdd: user story: {user_story} | criteria: {ac}"

        # Tokenize input
        inputs = self.tokenizer(
            input_text,
            max_length=self.max_input_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        # Tokenize target
        targets = self.tokenizer(
            target,
            max_length=self.max_target_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        labels = targets["input_ids"].squeeze(0)
        # Replace padding token id with -100 so it's ignored by the loss function
        labels[labels == self.tokenizer.pad_token_id] = -100

        return {
            "input_ids": inputs["input_ids"].squeeze(0),
            "attention_mask": inputs["attention_mask"].squeeze(0),
            "labels": labels
        }

def run_training(dataset_path="dataset.json", output_dir="fine_tuned_model", base_model="google/flan-t5-small"):
    if not HAS_ML_DEPS:
        raise ImportError("HuggingFace Transformers and PyTorch are required for model training. Please install them by running: pip install torch transformers")
        
    print(f"Starting training pipeline. Loading dataset from {dataset_path}...")
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset file {dataset_path} not found.")

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} examples. Loading tokenizer and base model '{base_model}'...")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForSeq2SeqLM.from_pretrained(base_model)

    # Prepare dataset
    dataset = UserStoryDataset(data, tokenizer)

    # Define training arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=2,
        save_steps=10,
        save_total_limit=1,
        learning_rate=5e-5,
        predict_with_generate=True,
        logging_steps=2,
        evaluation_strategy="no",
        fp16=False, # Set to False for CPU compliance
        report_to="none"
    )

    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model)

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        tokenizer=tokenizer,
        data_collator=data_collator,
    )

    print("Beginning model fine-tuning...")
    trainer.train()

    print(f"Saving fine-tuned model and tokenizer to '{output_dir}'...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print("Training process completed successfully.")

if __name__ == "__main__":
    # Ensure current directory matches script location for dataset resolution
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    run_training()
