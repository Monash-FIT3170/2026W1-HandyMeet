# Gesture Drawing — Manual Test Plan

**Feature:** Gesture-based drawing on the whiteboard (`86d403qpq`)
**Why manual testing:** the feature depends on live camera input, hand-gesture recognition, and rendered canvas output, which unit tests can't meaningfully exercise.

## Environment

| Item         | Requirement                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Browser      | Chrome/Edge (latest), with camera permission granted                                                                |
| Camera       | Webcam with reasonable lighting; test both a well-lit and a dim room                                                |
| Participants | At least 1 tester with a free hand to gesture; a 2-participant meeting is needed for the concurrent-camera-off case |
| Setup        | Join a meeting, open the whiteboard panel                                                                           |

## How to use this document

Run each test case below, then fill in **Actual Result** and **Pass/Fail**. Leave **Notes** for anything unexpected (jitter, lag, wrong position, etc.), even on a Pass.

---

## 1. Basic drawing flow

| ID  | Steps                                                              | Expected Result                                                                                                          | Actual Result                                                                                    | Pass/Fail | Notes                                                                      |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------- |
| 1.1 | With camera on, open whiteboard, click "Gesture Draw" to enable it | Button shows "Gesture Draw: ON"; gesture control hints appear bottom-left                                                | Button turns blue as expected                                                                    | Pass      |                                                                            |
| 1.2 | Point your index finger at the camera and move your hand           | A cursor/preview line follows your finger on the canvas, roughly matching your hand's position and direction of movement | A blue dot appears and follows the index finger as it moves, drawing a blue line along that path | Pass      |                                                                            |
| 1.3 | While pointing, draw a simple shape (e.g. a circle)                | The line appears where you're actually pointing/moving, without visible offset from your intended path                   | Shape is created correctly                                                                       | Pass      | Hard to get a perfectly clean shape; slight lag and occasional cursor jump |
| 1.4 | Make a fist to end the stroke                                      | The stroke is committed to the tldraw canvas as a permanent shape; the live overlay preview clears                       | Works as expected; the line smooths out once saved                                               | Pass      |                                                                            |
| 1.5 | Draw a second, separate stroke elsewhere on the canvas             | Second stroke appears independently, doesn't connect to or overwrite the first                                           | Works cleanly                                                                                    | Pass      |                                                                            |

## 2. Stroke position accuracy (regression: coordinate offset bug)

| ID  | Steps                                                                                    | Expected Result                                                                         | Actual Result   | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------- | --------- | ----- |
| 2.1 | Pan the tldraw canvas (drag with the pan/hand tool or spacebar-drag), then draw a stroke | Stroke still lands under your finger's on-screen position, not offset by the pan amount | Works correctly | Pass      |       |
| 2.2 | Zoom in on the canvas, then draw a stroke                                                | Stroke still lands under your finger's on-screen position at the new zoom level         | Works correctly | Pass      |       |
| 2.3 | Resize the browser window (or whiteboard panel), then draw a stroke                      | Stroke position still tracks your finger correctly after the resize                     | Works correctly | Pass      |       |

_Corner-offset check against the header bar (drawing near the top-left of the canvas) was not practically testable in the current setup and has been dropped from this pass._

## 3. Camera state handling

| ID  | Steps                                                           | Expected Result                                                          | Actual Result     | Pass/Fail | Notes |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------- | --------- | ----- |
| 3.1 | Turn camera off, then click "Gesture Draw" to enable it         | An amber warning banner appears: camera is off, gesture drawing needs it | Works as expected | Pass      |       |
| 3.2 | With gesture drawing enabled and camera off, turn the camera on | Warning disappears; hand tracking starts working within a couple seconds | Works as expected | Pass      |       |

_The camera cannot currently be turned off while the whiteboard is open, so the mid-stroke camera-off case could not be tested and has been dropped from this pass._

## 4. Closing the whiteboard (regression: background tracking bug)

| ID  | Steps                                                                                         | Expected Result                                                                                                                                                   | Actual Result                                                                              | Pass/Fail | Notes |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- | ----- |
| 4.1 | Enable gesture drawing, then click "Close" on the whiteboard                                  | Whiteboard closes                                                                                                                                                 | Works as expected                                                                          | Pass      |       |
| 4.2 | After closing (step 4.1), check the camera/GPU indicator or make a fist gesture at the camera | No new strokes appear when you reopen the whiteboard; camera usage doesn't spike further — hand tracking should have actually stopped, not just be hidden         | Works as expected                                                                          | Pass      |       |
| 4.3 | Reopen the whiteboard after closing it with gesture drawing on                                | Gesture Draw toggle state and behavior are sane (either remembers ON and resumes tracking, or resets to OFF — confirm which, and that it's not broken either way) | Toggle persists whatever state it was left in — stays on if left on, stays off if left off | Pass      |       |

## 5. Hand tracking robustness

| ID  | Steps                                                                   | Expected Result                                                                                                | Actual Result                                                                                                            | Pass/Fail | Notes                                                                                                                                         |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Draw using your right hand, then switch to your left hand mid-session   | Tracking follows whichever hand is gesturing without jumping erratically between hands                         | Tracking follows whichever hand started drawing first, and only switches once that hand makes a fist or leaves the frame | Pass      |                                                                                                                                               |
| 5.2 | Show both hands to the camera at once, pointing with one                | Only the intended pointing hand drives the cursor; the second hand doesn't cause jitter or a stray cursor jump | Works cleanly                                                                                                            | Pass      |                                                                                                                                               |
| 5.3 | Tilt your hand at an angle (not flat/parallel to camera) while pointing | Pointing gesture is still recognized; cursor doesn't drop out or misfire as a fist                             | Generally recognized, but pointing straight down is sometimes misclassified as a fist                                    | Fail      | Gesture classifier needs better handling of steep downward angles                                                                             |
| 5.4 | Move your hand at a normal drawing pace (not deliberately slow)         | Line appears reasonably smooth, not jagged/stepped                                                             | Drawing quickly causes noticeable lag and breaks in the line; only smooth when drawn slowly                              | Fail      | May be hardware-dependent (tested on one laptop); needs re-testing on multiple devices to confirm whether this is a general performance issue |
| 5.5 | Draw a long, continuous stroke (30+ seconds without lifting/fisting)    | Stroke completes and saves without the app freezing, erroring, or crashing                                     | Completes without crashing; line breaks up while drawing due to lag, but smooths out once saved                          | Pass      | Same lag/line-breaking behavior as 5.4, tracked there                                                                                         |

## 6. Interaction with other features

| ID  | Steps                                                                                                       | Expected Result                                                                                                       | Actual Result | Pass/Fail | Notes |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------- | --------- | ----- |
| 6.1 | With meeting hand-gesture actions (e.g. mute/raise hand) also enabled, use gesture drawing at the same time | Both features work without visibly conflicting; check for major lag/frame drops with both hand-tracking loops running |               | Not run   |       |

---

## Known issues found during testing

- **Gesture misclassification at steep angles (5.3):** pointing straight down is sometimes read as a fist, ending the stroke unintentionally.
- **Lag / broken lines at fast draw speed (5.4, 5.5):** drawing quickly causes the in-progress line to visibly break up, though the saved stroke smooths out afterward. Not yet confirmed whether this is hardware-specific — needs testing on additional devices.

## Summary

| Section                            | Total cases | Passed | Failed | Not run |
| ---------------------------------- | ----------- | ------ | ------ | ------- |
| 1. Basic drawing flow              | 5           | 5      | 0      | 0       |
| 2. Stroke position accuracy        | 3           | 3      | 0      | 0       |
| 3. Camera state handling           | 2           | 2      | 0      | 0       |
| 4. Closing the whiteboard          | 3           | 3      | 0      | 0       |
| 5. Hand tracking robustness        | 5           | 3      | 2      | 0       |
| 6. Interaction with other features | 1           | 0      | 0      | 1       |
| **Total**                          | **19**      | **16** | **2**  | **1**   |

**Date:** 2026-08-30
**Browser/OS:** Windows Chrome
**Overall result:** Core drawing flow (point-to-draw, fist-to-save, multiple strokes) and both regression fixes (stroke positioning, tracking stopping on close) pass. Two issues to fix and retest in the next milestone: gesture misclassification when pointing at steep downward angles, and lag/line breakup at fast draw speed.
