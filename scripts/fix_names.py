import re

file_path = "apps/api/src/routes/papers.ts"

with open(file_path, "r") as f:
    content = f.read()

# Replace processUploads with prepareUploadEntries
new_content = content.replace("function processUploads(", "function prepareUploadEntries(")
new_content = new_content.replace("await processUploads(", "await prepareUploadEntries(")

with open(file_path, "w") as f:
    f.write(new_content)

print("Renamed processUploads to prepareUploadEntries")
