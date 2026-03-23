#!/usr/bin/env python3
from google.cloud import firestore
import sys

# Initialize Firestore client
db = firestore.Client(project='bizomhire-dashboard')

# Reference to jobs collection
jobs_ref = db.collection('jobs')

# Get all documents
docs = jobs_ref.stream()

# Delete all documents
count = 0
for doc in docs:
    doc.reference.delete()
    count += 1
    print(f"Deleted document {doc.id}")

print(f"\n✅ Successfully deleted {count} job openings from Firestore!")
