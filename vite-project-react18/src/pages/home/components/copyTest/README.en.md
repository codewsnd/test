h1. CopyTest User Guide

h2. 1. What is CopyTest?

CopyTest compares copy in a Confluence table with UI screenshots and generates:

* *Test Result*: Passed, Failed, related Screens, and failure reasons.
* *Test Evidence*: screenshots supporting the validation result.

After reviewing the results, you can export them back to Confluence or download the complete table as PDF, Word, or Excel.

{info:title=Current environment notice}
Validate currently uses random Mock data and does not inspect the real screenshot content. The Mock is intended only for testing page operations, merged cells, image deletion, and export. Do not use Mock results as formal test evidence.
{info}

h2. 2. Quick start

h3. Step 1: Import a Confluence page

# Paste the page address into *Confluence URL*.
# Click *Import*.
# After a successful import, the Table selector, Comparison Column selector, and table preview are displayed.

_{Insert screenshot here}_

The URL must start with {{http://}} or {{https://}}.

If the URL or import is invalid, the error appears below the input and the previous table is hidden.

h3. Step 2: Select a Table

Choose the table you want to work with from *Table*.

* Valid tables are displayed continuously as {{Table1}}, {{Table2}}…{{TableN}}.
* Selecting another Table clears the current Comparison Column.
* Selecting another Table also clears screenshots that have not been validated.

h3. Step 3: Select a Comparison Column

Choose the copy column to compare with the screenshots.

* A blank header is displayed as {{Column N}}.
* Duplicate headers include {{Column N}} so they can be distinguished.
* Existing Test Result and Test Evidence columns are excluded.

After selection, the preview shows only:

* Row selection
* Source column
* Test Result
* Test Evidence

Clear the Comparison Column to return to the complete table preview.

h3. Step 4: Select rows

Non-empty rows are selected by default. Clear any row that should not be validated.

Merged cells in the source column are always treated as one unit.

For example, if rows 2 and 3 are merged:

{code:language=text}
Row 1: handled independently
Rows 2–3: handled as one unit
Row 4: handled independently
{code}

Rows 2 and 3 cannot be validated separately. Their Test Result and Test Evidence will not be split in the middle.

h3. Step 5: Upload screenshots

# Click *Upload Screenshot*.
# Click *Select screenshots* and choose one or more screenshots.
# Review the list and click *Validate*.

Upload limits:

|| Item || Limit ||
| File type | Image files |
| Maximum count | 50 images |
| Maximum total size | 10 MB |
| Duplicate images | Automatically removed by image content |

After Validate completes, the upload window closes and the current upload list is cleared.

h3. Step 6: Review the results

Test Result displays:

* *Passed*: the screenshot contains reliable support for the expected copy.
* *Failed*: the copy is missing, incomplete, different, or cannot be confirmed.
* *Screen01, Screen02…*: Evidence images related to that row.

Test Evidence displays the screenshots. Click an image to open a larger preview.

h2. 3. Evidence merging and Screen numbers

One screenshot can support multiple rows, and one row can use multiple screenshots.

When adjacent rows share screenshots, their Test Evidence can be merged. Each Test Result still lists only the Screens used by that row.

Example:

|| Row || Expected copy || Matching screenshots ||
| 1 | 你好 | Image A |
| 2 | 我在 | Image A |
| 3 | 吃饭 | Images A and B |

If Image A contains “你好我在吃饭” and Image B contains “吃饭”:

* Test Evidence for rows 1–3 is merged and displays Images A and B.
* Row 1: Passed + Screen01.
* Row 2: Passed + Screen01.
* Row 3: Passed + Screen01 and Screen02.
* Unrelated images are not displayed.

A Screen number only represents the display order within the current Evidence group.

h2. 4. Delete an Evidence image

Delete buttons are displayed only after a Comparison Column is selected.

After an image is deleted, CopyTest automatically:

* Removes it from Test Evidence.
* Updates related Screen references in Test Result.
* Renumbers the remaining Screens.
* Recalculates Evidence merging.
* Removes Passed or Failed when a row has no images left.

For example, after Screen01 is deleted, the previous Screen02 becomes Screen01.

If rows 2 and 3 were originally one merged source cell, they remain one unit after deletion.

h2. 5. Export

Hover over *Export* to choose:

|| Option || Exported content ||
| Confluence | Test Result and Test Evidence for the current Comparison Column |
| PDF | The complete selected Table |
| Word | The complete selected Table |
| Excel | The complete selected Table |

h3. Export to Confluence

# Complete Validate or delete the required images.
# Hover over *Export*.
# Click *Confluence*.
# Click *Confirm* in the confirmation dialog.

Only the Test columns for the current Comparison Column are updated. Other source columns and Test columns created for other Comparison Columns are preserved.

If the Confluence table changed after import and cannot be updated safely, CopyTest asks you to import it again instead of forcing an overwrite.

After a successful export, import the page again to confirm that data, images, and merged cells match between Confluence and CopyTest.

h3. Export a local file

* PDF, Word, and Excel include the complete selected Table.
* Passed is green and Failed is red.
* Test Evidence includes images.
* PDF keeps the complete table on one page; an extremely large table may not be exportable.
* The file name uses the current date and time, for example {{20260723153045.pdf}}.

h2. 6. Common errors

|| Situation || Message or action ||
| Invalid URL format | {{In valid URL format, Please enter a valid Http:// or https:// URL}} |
| No valid table on the page | {{No valid table found}} |
| URL, permission, or Token problem | Check the Confluence URL, login, or Token, then import again |
| A selected file is not an image | Select image files only |
| More than 50 images | Remove some images and try again |
| Total image size exceeds 10 MB | Compress or remove images and try again |
| The Confluence table changed | Import the page again before continuing |
| Local export fails | Confirm that all Evidence images are visible and try again |

h2. 7. Tips

* Editing the URL immediately clears the imported session and unsaved work.
* Rows with empty copy cannot be validated.
* Without a Comparison Column, you can preview and export the complete table, but you cannot upload screenshots or delete Evidence.
* Uploading the same image more than once keeps only one copy.
* Before exporting to Confluence, confirm that the correct Table and Comparison Column are selected.
* Validate currently uses random Mock results. Connect the real AI service before using validation results in production.
