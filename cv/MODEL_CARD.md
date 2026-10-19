# Model card: yolo-v1

The first YOLO model for the Preparation checkpoint. Read from the file itself on 2026-10-19
(`torch.load` of the checkpoint, then `YOLO(...)` through the station). Everything below matches
the table in `camera-yolo-integration.md`; nothing in the file differed.

## The file

| Field          | Value                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| File           | `cv/models/yolo-v1.pt` (23,646,230 bytes), never committed (D-049)                   |
| SHA-256        | `1d729fb0358d3140d5491d4124e2173ec228e42875e06a31a69f4530d83f157b`                   |
| `modelVersion` | `yolo-v1-1d729fb0` (sent with every scan)                                            |
| Saved          | 2026-07-21, Ultralytics 8.4.103                                                      |
| Base model     | `yolo26s-seg` (YOLO26 small, segmentation), end-to-end head (no NMS)                 |
| Task           | `segment`: a mask and a box per detection                                            |
| Classes        | `0 crease`, `1 cut`, `2 hole`, `3 scratch` (the model's own `names`)                 |
| Input size     | trained at `imgsz=1536`; the station runs at the same size                           |
| Weights        | FP16                                                                                 |
| Training       | 300 epochs, batch 4, dataset `preparation-images` (hosted, not in repo)              |
| Licence        | AGPL-3.0 (Ultralytics). Fine for the capstone demo; review before any commercial use |

## Validation (from the checkpoint)

| Metric    | Box   | Mask  |
| --------- | ----- | ----- |
| Precision | 0.618 | 0.597 |
| Recall    | 0.686 | 0.623 |
| mAP50     | 0.657 | 0.610 |
| mAP50-95  | 0.436 | 0.320 |

## Runtime it was checked with

Python 3.13.14, ultralytics 8.4.103, torch 2.6.0+cu124, on Dylan's laptop (RTX 3060 Laptop GPU).
Time per image at `imgsz=1536`, preprocessing to postprocessing, on small simulator images:
about **255 ms on the GPU** and **780 ms on the CPU**. Both are fine for one capture per section.

## Intended use

Finds surface defects on one leather section at a time at Preparation, before cutting (D-005).
The station reports what the model saw; the app decides the verdict (D-011), and the Quality
Inspector decides every flagged section (D-028).

## Known limits

- **Early model, not fine-tuned.** About one detection in three is wrong (precision 0.62) and about
  one defect in three is missed (recall 0.69). Mask outlines are rougher still (mask mAP50-95 0.32).
- **Confidence is not severity.** The app reads the highest confidence as how bad a defect is
  (D-011). For this model it means how sure it is that a defect is there. See the baseline numbers
  before setting thresholds in Settings.
- **Class keys differ from the app's.** The app knows `cut`, `hole`, `abrasion` and `dirt`, so
  `crease` and `scratch` send a scan to review until they're added under Settings → Defect types
  (Phase 15).
- Trained on the team's own photos. Different lighting, leather colours or camera distance may
  lower accuracy.

## Baseline (2026-10-19)

Five photos from `Sample Photos (CAP2)` on Dylan's laptop (1536 × 1536 JPEGs; kept out of git),
GPU, floor 0.25, about 360 ms per image. **Five photos is a smoke test, not an evaluation**, and it
isn't confirmed that they were left out of training. Run it again on a larger held-out set.

| Class   | Detections | Images | Lowest | Median | Highest |
| ------- | ---------: | -----: | -----: | -----: | ------: |
| scratch |         16 |      3 |   0.29 |   0.61 |    0.92 |
| hole    |          5 |      2 |   0.38 |   0.79 |    0.96 |
| cut     |          4 |      3 |   0.46 |   0.68 |    0.92 |
| crease  |          1 |      1 |   0.51 |   0.51 |    0.51 |

Preview verdicts per photo (the app's rule, D-011, with each set of settings):

| Settings                                                  | PASS | REWORK | REJECT | NEEDS_REVIEW |
| --------------------------------------------------------- | ---: | -----: | -----: | -----------: |
| Today: `cut`, `hole`, `abrasion`, `dirt`; 0.60 / 0.90     |    0 |      1 |      0 |            4 |
| `crease` and `scratch` added; 0.60 / 0.90                 |    1 |      3 |      1 |            0 |
| `crease` and `scratch` added; 0.50 / 0.80, or 0.40 / 0.70 |    0 |      2 |      3 |            0 |

What it shows:

- **Class keys (gap 1):** under today's settings 4 of 5 photos go to review only because `crease`
  or `scratch` is unknown to the app.
- **Confidence is not severity (gap 2):** with the classes added, the photo whose only finding is a
  crease at 0.51 passes. In `IMG_6742` a long, clear cut scores only 0.51, so the cut alone would
  pass; the section lands on REWORK because of a scratch at 0.66. Lowering the thresholds moves
  more photos to REJECT rather than telling defects apart by how bad they are.
- **Duplicates:** the model sometimes reports the same scratch twice with nearly the same box
  (e.g. 0.63 and 0.60). It doesn't change the verdict (the highest confidence decides) but inflates
  counts per class. Since Phase 16 the mapper keeps only the more confident of two same-class
  boxes overlapping by IoU ≥ 0.7 (`[mapper] overlap_iou`, D-057).

Phase 16 added "When found" actions per defect type (D-053): with cut and hole on Reject and
crease and scratch on Rework, all five photos get the verdict a person would expect. See
`reports/2026-10-19-yolo-v1.md`, a small check, not a measurement.
