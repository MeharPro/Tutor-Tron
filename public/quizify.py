from flask import Flask, request, render_template, send_file
import os
import time
import google.generativeai as genai

app = Flask(__name__)

# Configure the GenAI API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Preload the template CSV file
PRELOADED_TEMPLATE_PATH = "Sample_Question_Import_UTF8.csv"

def upload_to_gemini(path, mime_type=None):
    
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"Uploaded file '{file.display_name}' as: {file.uri}")
    return file

def wait_for_files_active(files):
    print("Waiting for file processing...")
    for name in (file.name for file in files):
        file = genai.get_file(name)
        while file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(10)
            file = genai.get_file(name)
        if file.state.name != "ACTIVE":
            raise Exception(f"File {file.name} failed to process")
    print("...all files ready")
    print()

# Generation configuration for GenAI
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",
    generation_config=generation_config,
    system_instruction="""You are a Brightspace Quiz Generator. Create a comprehensive quiz CSV file based on the user's specified topic. Follow these precise instructions:
- Quiz Generation Requirements:
    - Use the provided CSV template exactly
    - Only do Multiple Choice (MC) and True/False (TF) Questions!
    - Generate unique question IDs in format {CourseCode}{QuestionNumber}
    - Include elements like hints and feedback
    - Generate 5-20 questions per quiz
    - Vary question difficulty (1-7 scale)
    - Assign appropriate point values
    - Create realistic, contextually relevant answer options
    - Ensure at least 2 different question types per quiz
    - Use proper grammer when generating questions and answers with proper english
    - Make the questions clear and easy to understand 
    - Ensure that the questions diffrent for each other
    - Ensure that the questions are not too long
    - Ensure you give proper choices for answers
    - Make the answers clear and easy to understand 
    - Ensure that you use proper grammer when generating answers and choices with proper english
- CSV Formatting:
    - Strictly follow the column structure in the sample template
    - Use CSV UTF-8 encoding
    - Randomize correct answer positions
    - Use the lesson PDF to create the quiz.""",
)

@app.route('/')
def home():
    # Serve the HTML form
    return render_template('index.html')

@app.route('/generate_quiz', methods=['POST'])
def generate_quiz():
    try:
        # Save the uploaded lesson PDF
        lesson_pdf = request.files['lesson_pdf']
        lesson_pdf_path = "Lesson.pdf"
        lesson_pdf.save(lesson_pdf_path)

        # Upload files to Gemini
        files = [
            upload_to_gemini(PRELOADED_TEMPLATE_PATH, mime_type="text/csv"),
            upload_to_gemini(lesson_pdf_path, mime_type="application/pdf"),
        ]

        # Wait for files to be processed
        wait_for_files_active(files)

        # Start a chat session with the model
        chat_session = model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        files[0],
                        files[1],
                    ],
                },
                {
                    "role": "model",
                    "parts": ["[NUMBER OF QUESTIONS]\n"],
                },
            ]
        )

        # Get the number of questions from the form
        num_questions = request.form['num_questions']
        response = chat_session.send_message(f"{num_questions} questions")

        # Save the generated quiz to a CSV file
        output_file = "quiz.csv"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(response.text)

        # Serve the generated CSV file as a download
        return send_file(output_file, as_attachment=True)

    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    # Ensure the preloaded template file exists
    if not os.path.exists(PRELOADED_TEMPLATE_PATH):
        raise FileNotFoundError(f"Preloaded template CSV not found at {PRELOADED_TEMPLATE_PATH}.")
    app.run(debug=True)
