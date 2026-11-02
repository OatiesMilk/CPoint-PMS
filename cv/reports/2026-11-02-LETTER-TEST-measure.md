# Measuring defects: roll LETTER-TEST (2026-11-02)

Model `yolo-v1-1d729fb0`. Preview settings: found at 0.50; Not accepted (Reject): cut, hole; Usable (Pass): crease, scratch; inactive: abrasion, dirt; unknown classes: Reject. Confidence floor 0.25, imgsz 1536, device cpu.

**Decision (Dylan, 2026-11-02, D-106): defects are measured by the box.** Length is the box
diagonal; area is each shot's union of boxes (overlaps once) over the roll's entered area. Known
cost: a slanted cut's box is mostly clean leather (below, the 5.5 in line's box is 15.33 sq in,
19.4% of the piece, against 1.0% by outline), so Phase 30C watches slanted cuts.

Phase 30B check (D-106 was decided from this). Lengths in inches, areas in square inches unless said. Box = the detection's box (its diagonal is the length); outline = the mask outline (its longest span is the length). Overlapping defects on one shot are counted once (C-35).

## Scale

| Shot           | From   | Width seen (in) | Pixels per inch | Note |
| -------------- | ------ | --------------: | --------------: | ---- |
| cut-2.5in.jpeg | itself |           18.53 |           163.2 |      |
| cut-3.5in.jpeg | itself |           18.41 |           164.3 |      |
| cut-5.5in.jpeg | itself |           18.47 |           163.7 |      |

## Defects found

| Shot           | Class         | Conf. | Box w x h   | Diagonal | Box area | Outline area | Span | Where  |
| -------------- | ------------- | ----: | ----------- | -------: | -------: | -----------: | ---: | ------ |
| cut-2.5in.jpeg | nothing found |       |             |          |          |              |      |        |
| cut-3.5in.jpeg | cut           |  0.57 | 3.49 x 0.81 |     3.58 |     2.84 |         0.44 | 3.61 | centre |
| cut-5.5in.jpeg | cut           |  0.92 | 3.14 x 4.88 |     5.80 |    15.33 |         0.54 | 5.86 | centre |

## Against the ruler

| Shot           | Ruler | Matched       | Diagonal |   Off | Span |   Off | 3-inch side (box) | 3-inch side (outline) |
| -------------- | ----: | ------------- | -------: | ----: | ---: | ----: | ----------------- | --------------------- |
| cut-2.5in.jpeg |  2.50 | nothing found |        — |     — |    — |     — | —                 | —                     |
| cut-3.5in.jpeg |  3.50 | cut           |     3.58 | +0.08 | 3.61 | +0.11 | yes               | yes                   |
| cut-5.5in.jpeg |  5.50 | cut           |     5.80 | +0.30 | 5.86 | +0.36 | yes               | yes                   |

## Per shot and the roll

| Shot           | Defects | Union by box | Union by outline |
| -------------- | ------: | -----------: | ---------------: |
| cut-2.5in.jpeg |       0 |         0.00 |             0.00 |
| cut-3.5in.jpeg |       1 |         2.84 |             0.44 |
| cut-5.5in.jpeg |       1 |        15.33 |             0.54 |

Roll LETTER-TEST: area 0.649 sq ft (entered). Defect area 0.1262 sq ft by box, 0.0068 sq ft by outline: **19.4%** by box, **1.0%** by outline. Over 10% (Return to supplier, C-9): by box yes, by outline no.

## Answers

- Box or outline: The **box** is closer to the ruler: the outline's longest span is off by 0.24 in on average, the box diagonal by 0.19 in.
- Centre and edges: centre 2: box off 0.19, outline off 0.24 on average; edges none.
- The 3-inch line (C-37): by box it holds, by outline it holds, on 2 matched defect(s).
- The share on this piece: 19.4% by box, 1.0% by outline.
- Area: the boxes cover 18.6 times the outlines' area. A thin or slanted defect's box is mostly clean leather, so the share reads higher by box. Only the box puts this piece over 10%. (Claude recommended the outline; Dylan chose the box, D-106.)

This changes nothing in the app. Dylan chose the box; D-106 records it.
