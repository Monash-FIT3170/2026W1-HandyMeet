# Two-Hand Gesture Drawing — Manual Test Plan

**Feature:** Two-hand gesture drawing on the whiteboard (`14yhc7kue86`)
**Why manual testing:** the feature depends on live camera input, hand-gesture recognition, and rendered canvas output, which unit tests can't meaningfully exercise.

## What's different from single-hand gesture drawing

One hand always tracks the cursor (whatever pose it's in); the other hand controls drawing by making a fist. Which physical hand is which isn't fixed — whichever hand is fisted is the control hand, so it should work equally for left- and right-handed testers, and for switching hands mid-session.

## Environment

| Item         | Requirement                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| Browser      | Chrome/Edge (latest), with camera permission granted                         |
| Camera       | Webcam with reasonable lighting                                              |
| Participants | At least 1 tester with **both hands** free to gesture                        |
| Setup        | Join a meeting, open the whiteboard panel, click "Gesture Draw" to enable it |

## Testing scope and limitations

This pass was run on a single device/machine, in one lighting condition. Hand-tracking performance can vary with camera quality, lighting, and GPU, so results here aren't guaranteed to hold on other hardware. Future work: repeat this plan on additional devices and environments (different cameras, lighting, laptops vs desktops) to confirm these results generalize.

## How to use this document

Run each test case below, then fill in **Actual Result** and **Pass/Fail**. Leave **Notes** for anything unexpected (jitter, lag, wrong hand, wrong position, etc.), even on a Pass.

---

## 1. Basic two-hand drawing flow

| ID  | Steps                                                                         | Expected Result                                                                                 | Actual Result                                                                | Pass/Fail | Notes                                                                                       |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| 1.1 | Enable gesture drawing, show one hand to the camera, move it around           | A cursor dot follows that hand's fingertip; no drawing happens yet                              | Tracking is accurate once it starts, slightly unsmooth but barely noticeable | Pass      | Takes a couple of seconds for gesture drawing to actually turn on after clicking the button |
| 1.2 | Show your second hand too, make a fist with it                                | The fisted hand becomes "control"; the other hand's fingertip keeps driving the cursor          | Nicely switches between drawing and non-drawing mode                         | Pass      |                                                                                             |
| 1.3 | While holding the fist, move your cursor hand to draw a shape (e.g. a circle) | A line follows the cursor hand's path, matching its actual movement without exaggeration or lag | Follows the line well                                                        | Pass      |                                                                                             |
| 1.4 | Open the fist (flat palm) to end the stroke                                   | The stroke is committed to the tldraw canvas; the live overlay preview clears                   | Works as expected, saves nicely                                              | Pass      |                                                                                             |
| 1.5 | Draw a second, separate stroke elsewhere on the canvas                        | Second stroke appears independently, doesn't connect to or overwrite the first                  | Works nicely                                                                 | Pass      |                                                                                             |

## 2. Left/right-hand support (`14yhc7kue86`)

| ID  | Steps                                                                        | Expected Result                                                                   | Actual Result        | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- | --------- | ----- |
| 2.1 | Draw using your **right hand** as cursor and **left hand** fisted as control | Works exactly as in section 1                                                     | Works nicely         | Pass      |       |
| 2.2 | Draw using your **left hand** as cursor and **right hand** fisted as control | Works exactly as in section 1, with no setup/toggle needed to "switch handedness" | Works quite smoothly | Pass      |       |

## 3. Hand-role switching mid-session (regression: role-swap and phantom-line bugs)

| ID  | Steps                                                                                                                      | Expected Result                                                                                                        | Actual Result                                                                                                                | Pass/Fail | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| 3.1 | While your control hand is fisted and you're mid-stroke, open it to a flat palm **without** fisting your other hand        | Drawing stops; the cursor hand does **not** swap to the other hand just because the fist went away                     | Drawing stops as expected, keeps tracking the same drawing hand                                                              | Pass      |       |
| 3.2 | Mid-stroke, deliberately fist your drawing (cursor) hand while opening your control hand, so the two hands swap roles      | Drawing continues seamlessly from the new cursor hand's position; **no line is drawn connecting the old and new hand** | Swaps seamlessly, does not connect the old and new hand                                                                      | Pass      |       |
| 3.3 | Make a fist with **both** hands at the same time                                                                           | Whichever hand was already "control" stays control — it doesn't jump to a fixed hand (e.g. always "the right hand")    | Doesn't swap hands or freak out - keeps drawing with the same drawing hand even while the toggle hand is also fisted         | Pass      |       |
| 3.4 | Briefly lower one hand out of frame and bring it back (simulating a dropped-tracking frame), without changing your gesture | Hand roles stay the same as before the hand briefly left frame                                                         | Tried with both the control hand and the drawing hand going out of frame - both kept their original role when they came back | Pass      |       |

## 4. Stroke smoothness (regression: zigzag/jitter bug)

| ID  | Steps                                                                        | Expected Result                                                                                    | Actual Result                                                                                                                     | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| 4.1 | Hold your cursor hand as still as possible while drawing                     | The line stays essentially a single point/dot, no zigzag from small natural hand tremor            | Very stable, follows the finger point; some slight movement remains since it's not possible to be 100% still, but that's expected | Pass      |       |
| 4.2 | Make small, slow, deliberate movements while drawing                         | The drawn line matches the movement at roughly the right length/shape, not exaggerated or jagged   | Follows the finger/drawing hand very nicely                                                                                       | Pass      |       |
| 4.3 | Draw a fast, continuous stroke (normal drawing speed, not deliberately slow) | Line is reasonably smooth; compare by feel against the single-hand version — should not feel worse | Slight lag but smooth and nice                                                                                                    | Pass      |       |

## 5. Stroke position accuracy

| ID  | Steps                                                                                    | Expected Result                                                                              | Actual Result                                                                    | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- | ----- |
| 5.1 | Pan the tldraw canvas (drag with the pan/hand tool or spacebar-drag), then draw a stroke | Stroke still lands under your cursor hand's on-screen position, not offset by the pan amount | Aligned with the on-screen hand tracking position, pan doesn't affect the stroke | Pass      |       |
| 5.2 | Zoom in on the canvas, then draw a stroke                                                | Stroke still lands under your cursor hand's on-screen position at the new zoom level         | Works as expected for both zoom in and out                                       | Pass      |       |
| 5.3 | Resize the browser window (or whiteboard panel), then draw a stroke                      | Stroke position still tracks your cursor hand correctly after the resize                     | Works as expected                                                                | Pass      |       |

## 6. Camera state handling

| ID  | Steps                                                           | Expected Result                                                          | Actual Result | Pass/Fail | Notes |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- | --------- | ----- |
| 6.1 | Turn camera off, then click "Gesture Draw" to enable it         | An amber warning banner appears: camera is off, gesture drawing needs it |               | Pass      |       |
| 6.2 | With gesture drawing enabled and camera off, turn the camera on | Warning disappears; hand tracking starts working within a couple seconds |               | Pass      |       |

## 7. Closing the whiteboard

| ID  | Steps                                                                             | Expected Result                                                                                                                                                   | Actual Result                                                                                                  | Pass/Fail | Notes |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| 7.1 | Enable gesture drawing, then click "Close" on the whiteboard                      | Whiteboard closes                                                                                                                                                 |                                                                                                                | Pass      |       |
| 7.2 | After closing (step 7.1), make gestures at the camera, then reopen the whiteboard | No new strokes appear from gesturing while the whiteboard was closed — hand tracking should have actually stopped, not just be hidden                             | Only checked that no new stroke appeared                                                                       | Pass      |       |
| 7.3 | Reopen the whiteboard after closing it with gesture drawing on                    | Gesture Draw toggle state and behavior are sane (either remembers ON and resumes tracking, or resets to OFF — confirm which, and that it's not broken either way) | Keeps whatever state it was left in - stays on if left on, stays off if left off, works again without crashing | Pass      |       |

## 8. Interaction with other features

| ID  | Steps                                                                                                       | Expected Result                                                                                                       | Actual Result                                       | Pass/Fail | Notes                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | With meeting hand-gesture actions (e.g. mute/raise hand) also enabled, use gesture drawing at the same time | Both features work without visibly conflicting; check for major lag/frame drops with both hand-tracking loops running | Worked nicely, gestures and drawing both still work | Pass      | Specifically checked that the toggle hand making a palm (to stop drawing) doesn't trigger the raise-hand gesture - it only fired the raise-hand gesture when a single hand was visible |

---

## Known issues found during testing

None. The only thing worth noting is a short (couple of seconds) delay between clicking "Gesture Draw" and tracking actually starting (test 1.1) — this is the hand-tracking model loading, not a functional bug.

## Summary

| Section                            | Total cases | Passed | Failed | Not run |
| ---------------------------------- | ----------- | ------ | ------ | ------- |
| 1. Basic two-hand drawing flow     | 5           | 5      | 0      | 0       |
| 2. Left/right-hand support         | 2           | 2      | 0      | 0       |
| 3. Hand-role switching mid-session | 4           | 4      | 0      | 0       |
| 4. Stroke smoothness               | 3           | 3      | 0      | 0       |
| 5. Stroke position accuracy        | 3           | 3      | 0      | 0       |
| 6. Camera state handling           | 2           | 2      | 0      | 0       |
| 7. Closing the whiteboard          | 3           | 3      | 0      | 0       |
| 8. Interaction with other features | 1           | 1      | 0      | 0       |
| **Total**                          | **23**      | **23** | **0**  | **0**   |

**Date:** 2026-10-16
**Browser/OS:** Windows Chrome
**Overall result:** All 23 test cases passed on the hardware tested. Left/right-hand support and all hand-role switching edge cases (open-palm role swap, phantom line on hand swap, both-fists sticky behavior, brief tracking dropout) behave correctly. As noted above, this pass was single-device/single-environment — multi-device and multi-environment testing is still future work.
