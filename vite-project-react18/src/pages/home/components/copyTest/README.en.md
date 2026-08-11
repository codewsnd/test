# CopyTest User Guide

[中文用户指南](./README.md)

## What CopyTest does

CopyTest compares copy in a Confluence table with page screenshots and creates two result columns:

- **Test Result**: Passed, Failed, related Screens, and issue details.
- **Test Evidence**: screenshots used by the validation result.

After reviewing the results, you can write them back to Confluence or export them as PDF, Word, or Excel.

## How to use CopyTest

### 1. Import a Confluence page

1. Paste the page address into **Confluence URL**.
2. Click **Import**.
3. Wait for the table preview to appear.

The address must start with `http://` or `https://`, and your account must have access to the page.

[截图]

### 2. Select a table and copy column

1. Select the table from **Table**.
2. Select the copy column from **Comparison Column**.
3. Confirm that **Test Result** and **Test Evidence** appear in the preview.

Rows with copy are selected by default. Clear any row you do not want to validate. Merged cells are handled as one group.

[截图]

### 3. Upload screenshots and validate

1. Click **Upload Screenshot**.
2. Click **Select screenshots** and choose one or more images.
3. Review the image list, then click **Validate**.

You can select up to 50 images at a time, with a maximum total size of 10 MB. Duplicate images are removed automatically.

[截图]

### 4. Review the results

- **Passed**: the screenshot supports the expected copy.
- **Failed**: the copy is missing, incomplete, different, or cannot be confirmed.
- **Screen01 (file name), Screen02 (file name)…**: Evidence images related to the result; file extensions are omitted.

Click an Evidence image to open a larger preview.

[截图]

## Adjust results

### Change a status

You can change the Passed or Failed status of an individual Screen in Test Result. The adjusted status is kept when more screenshots are validated.

### Delete an image

Click the delete button below a Test Evidence image and confirm. CopyTest will:

- Remove the Evidence image.
- Remove its related Test Result entry.
- Renumber the remaining Screens.

If more images are uploaded later, the deleted result will not return automatically.

[截图]

## Export results

Hover over **Export** to choose an option:

| Option | Purpose |
|---|---|
| Confluence | Write the current Test Result and Test Evidence back to the page |
| PDF | Download a PDF file |
| Word | Download a Word file |
| Excel | Download an Excel file |

### Write back to Confluence

1. Confirm that the correct Table and Comparison Column are selected.
2. Choose **Export > Confluence**.
3. Click **Confirm** in the confirmation dialog.
4. Wait for the success message.

After a successful export, import the page again to confirm that Confluence matches the current preview.

[截图]

### Download a local file

Choose PDF, Word, or Excel to download the current table and its test results. Images shown in Test Evidence are included in the file.

## Common issues

| Issue | What to do |
|---|---|
| The page cannot be imported | Check the page address and access permission, then import again |
| No table is available | Confirm that the Confluence page contains a table |
| Validate is unavailable | Select a copy column and at least one row, then upload an image |
| An image cannot be uploaded | Confirm that it is an image and check the count and total size |
| Writing back fails | Import the page again, review the content, and retry the export |
| An image is not displayed | Import again and confirm that your account can access page attachments |
