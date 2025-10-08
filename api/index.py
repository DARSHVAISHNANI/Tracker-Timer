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
    # --- Part 1: Calculations ---
    duration_in_minutes = round(entry.duration / 60000, 2)
    duration_in_hours = entry.duration / 3600000
    
    try:
        date_obj = datetime.strptime(entry.day, '%Y-%m-%d')
        day_name = date_obj.strftime('%A')
    except ValueError:
        day_name = "Invalid Date"
        
    current_time_str = datetime.now().strftime("%I:%M %p")
    
    # --- Part 2: Save the individual log ---
    try:
        notion.pages.create(
            parent={"database_id": NOTION_LOGS_DB_ID},
            properties={
                "Activity": {"title": [{"text": {"content": entry.category}}]},
                "Duration (min)": {"number": duration_in_minutes},
                "Date": {"date": {"start": entry.day}}, # MODIFIED: Changed from rich_text to date
                "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
            }
        )
        print(f"Successfully created log for {day_name}, {entry.day}.")
    except Exception as e:
        print(f"Error creating Notion log page: {e}")

    # --- Part 3: Update the summary dashboard ---
    try:
        response = notion.databases.query(
            database_id=NOTION_SUMMARY_DB_ID,
            filter={"property": "Category", "title": {"equals": entry.category}}
        )
        
        results = response.get("results")
        if results:
            # Entry exists: Update it
            page_id = results[0]["id"]
            current_total_hours = results[0]["properties"]["Total Hours"]["number"] or 0
            new_total_hours = round(current_total_hours + duration_in_hours, 4)
            
            notion.pages.update(
                page_id=page_id,
                properties={
                    "Total Hours": {"number": new_total_hours},
                    "Target Hours": {"number": entry.target},
                    "Last Activity Date": {"date": {"start": entry.day}}, # MODIFIED
                    "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                    "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
                }
            )
            print(f"Updated '{entry.category}' summary.")
        else:
            # Entry doesn't exist: Create it
            initial_total_hours = round(duration_in_hours, 4)
            notion.pages.create(
                parent={"database_id": NOTION_SUMMARY_DB_ID},
                properties={
                    "Category": {"title": [{"text": {"content": entry.category}}]},
                    "Total Hours": {"number": initial_total_hours},
                    "Target Hours": {"number": entry.target},
                    "Last Activity Date": {"date": {"start": entry.day}}, # MODIFIED
                    "Day of Week": {"rich_text": [{"text": {"content": day_name}}]},
                    "Last Activity Time": {"rich_text": [{"text": {"content": current_time_str}}]}
                }
            )
            print(f"Created new summary entry for '{entry.category}'.")
            
        return {"message": "Log saved and summary updated successfully!"}
    except Exception as e:
        print(f"Error updating Notion summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to update Notion summary.")

# Root endpoint
@app.get("/")
def read_root():
    return {"status": "Timer API is running"}