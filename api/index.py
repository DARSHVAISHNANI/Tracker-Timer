import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
from dotenv import load_dotenv
from notion_client import Client

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Connect to MongoDB
MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.timerApp
collection = db.timeentries

# Connect to Notion
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_LOGS_DB_ID = os.getenv("NOTION_DATABASE_ID")
NOTION_SUMMARY_DB_ID = os.getenv("NOTION_SUMMARY_DB_ID")
notion = Client(auth=NOTION_API_KEY)

# Pydantic Model
class TimeEntry(BaseModel):
    category: str
    duration: int
    day: str
    target: float

# API Endpoint
@app.post("/save-time")
async def save_time(entry: TimeEntry):
    # --- [DEBUG] Print incoming data ---
    print(f"Received request with data: {entry}")

    # --- Part 1: Calculations ---
    duration_in_minutes = round(entry.duration / 60000, 2)
    duration_in_hours = entry.duration / 3600000
    
    # --- [DEBUG] Print calculated durations ---
    print(f"Calculated duration: {duration_in_minutes} minutes, {duration_in_hours} hours")

    try:
        date_obj = datetime.strptime(entry.day, '%Y-%m-%d')
        day_name = date_obj.strftime('%A')
    except ValueError:
        day_name = "Invalid Date"
        
    current_time_str = datetime.now().strftime("%I:%M %p")
    
    # --- [DEBUG] Print date and time info ---
    print(f"Date processing: Day Name - {day_name}, Current Time - {current_time_str}")

    # --- Part 2: Save the individual log ---
    try:
        # --- [DEBUG] Print data being sent to Notion for log creation ---
        print(f"Creating Notion log with data: Category='{entry.category}', Duration='{duration_in_minutes}', Day='{entry.day}'")
        
        notion.pages.create(
            parent={"database_id": NOTION_LOGS_DB_ID},
            properties={
                "Activity": {"title": [{"text": {"content": entry.category}}]},
                "Duration (min)": {"number": duration_in_minutes},
                "Date": {"date": {"start": entry.day}},
                "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
            }
        )
        print(f"Successfully created log for {day_name}, {entry.day}.")
    except Exception as e:
        # --- [DEBUG] Enhanced error logging for Notion log creation ---
        print(f"Error creating Notion log page: {e}")
        # Optionally, you might want to raise an HTTPException here too
        # raise HTTPException(status_code=500, detail=f"Failed to create Notion log: {e}")

    # --- Part 3: Update the summary dashboard ---
    try:
        # --- [DEBUG] Print filter being used for Notion database query ---
        print(f"Querying Notion summary database for category: '{entry.category}'")
        
        response = notion.databases.query(
            database_id=NOTION_SUMMARY_DB_ID,
            filter={"property": "Category", "title": {"equals": entry.category}}
        )
        
        # --- [DEBUG] Print the raw response from Notion query ---
        print(f"Notion query response: {response}")
        
        results = response.get("results")
        if results:
            print("Found existing summary entry. Preparing to update.")
            page_id = results[0]["id"]
            current_total_hours = results[0]["properties"]["Total Hours"]["number"] or 0
            new_total_hours = round(current_total_hours + duration_in_hours, 4)
            
            # --- [DEBUG] Print values before updating summary ---
            print(f"Updating summary: Page ID='{page_id}', Current Hours='{current_total_hours}', New Total Hours='{new_total_hours}'")

            notion.pages.update(
                page_id=page_id,
                properties={
                    "Total Hours": {"number": new_total_hours},
                    "Target Hours": {"number": entry.target},
                    "Last Activity Date": {"date": {"start": entry.day}},
                    "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                    "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
                }
            )
            print(f"Updated '{entry.category}' summary.")
        else:
            print("No existing summary entry found. Creating a new one.")
            initial_total_hours = round(duration_in_hours, 4)
            
            # --- [DEBUG] Print values for new summary entry ---
            print(f"Creating new summary entry: Category='{entry.category}', Initial Hours='{initial_total_hours}'")

            notion.pages.create(
                parent={"database_id": NOTION_SUMMARY_DB_ID},
                properties={
                    "Category": {"title": [{"text": {"content": entry.category}}]},
                    "Total Hours": {"number": initial_total_hours},
                    "Target Hours": {"number": entry.target},
                    "Last Activity Date": {"date": {"start": entry.day}},
                    "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                    "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
                }
            )
            print(f"Created new summary entry for '{entry.category}'.")
            
        return {"message": "Log saved and summary updated successfully!"}
    except Exception as e:
        # --- [DEBUG] Enhanced error logging for summary update/creation ---
        print(f"Error updating Notion summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update Notion summary: {e}")

# Root endpoint
@app.get("/")
def read_root():
    return {"status": "Timer API is running"}