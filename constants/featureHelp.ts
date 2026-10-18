export type HelpSection =
  | 'basics'
  | 'captions'
  | 'gestures'
  | 'whiteboard'
  | 'insights'
  | 'notes';
export type HelpContext = 'meeting' | 'whiteboard';
export type HelpTask = {
  title: string;
  steps: readonly string[];
  outcome: string;
  troubleshooting?: string;
};
export type FeatureHelpContent = {
  id: HelpSection;
  title: string;
  description: string;
  requirement?: string;
  tasks: readonly HelpTask[];
};

export const featureHelp: readonly FeatureHelpContent[] = [
  {
    id: 'basics',
    title: 'Meeting basics',
    description: 'Create a room, invite people, and choose how to participate.',
    tasks: [
      {
        title: 'Create a meeting',
        steps: [
          'Enter Your name on the home screen. Leave Room code empty.',
          'Select Join Room. Allow microphone and camera access when prompted.',
        ],
        outcome:
          'You enter a new room. Your microphone and camera start enabled when permission is available.',
        troubleshooting:
          'If joining fails, check your connection and try again. If a device is blocked, allow access in your browser’s site permissions, then rejoin.',
      },
      {
        title: 'Join an existing meeting',
        steps: [
          'Ask the organiser for the room code.',
          'Enter Your name and the Room code, then select Join Room.',
        ],
        outcome: 'People using the same room code meet in the same room.',
        troubleshooting:
          'If you are alone unexpectedly, check the code with the organiser. Entering a different code opens a different room.',
      },
      {
        title: 'Invite someone',
        steps: [
          'Read the room code from the address bar: it is the part after /room/ and before any question mark.',
          'Send that code to your guests. Ask them to enter their own names and the code on the home screen.',
        ],
        outcome: 'Guests join your room using the shared code.',
      },
      {
        title: 'Control your microphone and camera',
        steps: [
          'Use the microphone and camera controls in the bottom toolbar to turn each device on or off.',
          'Check the control’s active or muted state before speaking or showing video.',
        ],
        outcome:
          'These controls change your own devices. You can participate with your camera off.',
        troubleshooting:
          'If others cannot hear you, check that your microphone is on and browser permission is allowed. Hand tracking can stay on when video sharing is off; the camera is then used locally for gestures.',
      },
      {
        title: 'Share your screen',
        steps: [
          'Select the screen-sharing control in the bottom toolbar.',
          'Choose a screen, window, or browser tab in the browser prompt and confirm sharing.',
          'Use the sharing control again, or the browser’s Stop sharing control, to finish.',
        ],
        outcome:
          'Other participants see the screen, window, or tab you selected.',
        troubleshooting:
          'If nothing appears, check that you confirmed the browser prompt. Cancelling that prompt does not start sharing.',
      },
      {
        title: 'Send a chat message',
        steps: [
          'Select Chat in the bottom toolbar.',
          'Type your message in the chat input and send it.',
        ],
        outcome:
          'Your message appears in the room chat for other participants.',
      },
      {
        title: 'Leave and view notes',
        steps: [
          'Select Leave.',
          'Select Leave Call to disconnect, or Cancel to remain in the meeting.',
          'On the notes screen, select Download before closing or refreshing. Generate Summary is optional.',
        ],
        outcome:
          'Leaving through this control opens your session’s transcript and meeting notes. Closing the browser tab does not open the notes screen.',
      },
    ],
  },
  {
    id: 'captions',
    title: 'Captions',
    description:
      'Read incoming speech and recognised gesture text. Caption appearance and visibility affect only your view.',
    requirement:
      'Captions are shown by default when text arrives. Hiding them does not stop the meeting’s transcription or delete your transcript.',
    tasks: [
      {
        title: 'Hide or restore captions',
        steps: [
          'Select Captions in the meeting toolbar or whiteboard controls to open Caption Settings.',
          'Switch Show Captions off to hide text, or on to show it.',
          'Close Caption Settings when finished. Opening or closing settings does not change caption visibility.',
        ],
        outcome: 'Incoming text is shown when Show Captions is on.',
        troubleshooting:
          'An empty display can mean no caption text has arrived. Ask someone to speak and check Show Captions. If speech still does not appear, ask the organiser to check transcription; participants cannot start the transcription service from this panel.',
      },
      {
        title: 'Make captions easier to read',
        steps: [
          'Open Captions → Caption Settings.',
          'Adjust Caption Size, Caption Colour, and Background Colour. Choose a preset or use Custom colour for text.',
          'Select Reset to Defaults to restore the initial appearance and turn Show Captions on.',
        ],
        outcome:
          'Changes apply immediately to your display. They are not saved as an account preference for future meetings.',
      },
      {
        title: 'Read more recent speech',
        steps: [
          'When captions appear, select Expand above the text.',
          'Select Collapse to return to the compact display.',
        ],
        outcome:
          'Expanded captions show up to eight recent speech segments; the compact view shows up to two. This is not the full meeting transcript.',
        troubleshooting:
          'Expand is available only after caption text arrives. Use the notes screen after leaving for the transcript captured during your session.',
      },
    ],
  },
  {
    id: 'gestures',
    title: 'Gestures and hand tracking',
    description:
      'Control your microphone or camera, send reactions, and display a limited set of letters and words using hand positions.',
    requirement:
      'Camera access is required. Recognition can make mistakes. Regular meeting controls remain available. This feature does not translate arbitrary sign language.',
    tasks: [
      {
        title: 'Enable hand tracking',
        steps: [
          'Allow camera access when prompted. Your video can stay off.',
          'Open Gestures in the bottom toolbar and switch Hand tracking on.',
          'Keep your hands fully visible and well lit. Check the dropdown for Hand detected.',
        ],
        outcome:
          'Hand detected means the tracker can see a hand; it does not mean a particular gesture has been recognised.',
        troubleshooting:
          'For No hand detected, move your hand into view and improve lighting. If camera access fails, check camera permission and try toggling tracking off and on.',
      },
      {
        title: 'Use gestures with video off',
        steps: [
          'Open Gestures and switch Hand tracking on.',
          'Turn video off using the camera control in the bottom toolbar.',
          'Keep using gestures. Switch Hand tracking off when you want to release the camera too.',
        ],
        outcome:
          'Other participants stop receiving your video. Your camera remains active locally for hand recognition, and recognised gestures still trigger meeting actions.',
      },
      {
        title: 'Perform a meeting gesture',
        steps: [
          'Choose an action, reaction, letter, or word from the gesture reference below.',
          'Match the finger positions and orientation. For a one-hand example, keep your other hand out of view; for a two-hand example, show both.',
          'Hold the position steadily for about one second, then release or change it before repeating.',
        ],
        outcome:
          'Mute and unmute change your microphone; camera off stops your video; request to leave opens a confirmation. Reactions show a participant banner, and letters or words appear as temporary gesture captions.',
        troubleshooting:
          'If a hand is detected but nothing happens, compare your finger positions and orientation with the reference, hold steadily, and release before retrying. Use the normal control if recognition remains unreliable.',
      },
      {
        title: 'Show tracking landmarks or stop tracking',
        steps: [
          'Open Gestures and switch Show overlay on to see landmarks on your own camera tile. Hand tracking must already be on.',
          'Switch Hand tracking off when you no longer want gestures to trigger meeting actions.',
          'Turn video on to see the overlay again. Hand tracking continues while video is off.',
        ],
        outcome:
          'The overlay is a visual aid on your local tile. Recognition can run without it, including while video sharing is off.',
      },
    ],
  },
  {
    id: 'whiteboard',
    title: 'Whiteboard and Gesture Draw',
    description:
      'Draw, add text, and discuss ideas on a canvas shared with the meeting.',
    requirement:
      'Canvas changes are shared. Export work you want to keep; closing the whiteboard returns to the call and is not a file save.',
    tasks: [
      {
        title: 'Draw, add text, or make a shape',
        steps: [
          'Select Whiteboard in the meeting toolbar.',
          'Choose Draw in the canvas toolbar and drag on the canvas to draw. Choose a shape tool and drag to create a shape.',
          'Choose Text, click on the canvas, and type. Switch to Select to move or resize an object.',
          'Use Undo in the canvas controls to undo your last edit. Deselect whiteboard button in control bar to return to meeting tiles.',
        ],
        outcome:
          'Other participants can see and edit the shared canvas. Your microphone, camera, and caption controls remain available.',
      },
      {
        title: 'Add a comment',
        steps: [
          'Choose the Comment tool in the canvas toolbar.',
          'Click a location on the canvas, type your comment, and submit it.',
          'Open a comment pin to read or reply to its thread.',
        ],
        outcome:
          'The comment is attached to that location on the shared board.',
      },
      {
        title: 'Draw a line with your camera',
        steps: [
          'Turn your camera on and select Gesture Draw in the whiteboard header. This is separate from meeting Hand tracking.',
          'Point your index finger with the other fingers curled. Move your hand to draw a short line; watch the cursor and stroke preview.',
          'Make a fist to finish the stroke and add it to the shared canvas.',
          'Keep your fist closed while repositioning, then point again to draw another stroke.',
          'Select Gesture Draw again to stop camera drawing. Use Undo to remove an unwanted completed stroke.',
        ],
        outcome:
          'Drawing… identifies a pointing hand. Finishing a stroke adds a canvas object; it does not save a file. Export the board to keep a copy.',
        troubleshooting:
          'If the camera-off message appears, turn your camera on. If no cursor appears, keep your hand visible and well lit. Finish with a fist before disabling drawing; disabling it clears the unfinished preview.',
      },
      {
        title: 'Save the whole board as an SVG',
        steps: [
          'Open the canvas main menu in the top-left corner.',
          'Choose Export as → SVG to download the whole board.',
          'Keep the downloaded file so you can import it later.',
        ],
        outcome:
          'A whole-board HandyMeet SVG export includes editable board data. Exporting only a selection through the selection/context menu is not a whole-board backup.',
        troubleshooting:
          'An empty board has nothing to export. Check the status message in the whiteboard header if an export fails.',
      },
      {
        title: 'Import an SVG without losing shared work',
        steps: [
          'Open the canvas main menu in the top-left corner and select Import SVG…',
          'Choose an SVG file.',
          'When offered a choice, select Add to the current whiteboard to keep existing content. Replace everything on the whiteboard clears it for everyone; export existing work first. Select Cancel to leave it unchanged.',
        ],
        outcome:
          'A HandyMeet whole-board export can return as editable shapes. An ordinary SVG is added as one image you can draw over. Replacement affects everyone and cannot be undone by other participants.',
        troubleshooting:
          'Check the header status for rejected or invalid files. Use an SVG file rather than a PNG or PDF.',
      },
    ],
  },
  {
    id: 'insights',
    title: 'Live insights',
    description:
      'Find suggested tasks in spoken conversation, then review them in the Action items panel.',
    requirement:
      'Action items and assignments are local to your current page session. They do not notify assignees or update other participants’ lists, and are not included in the notes download. Copy useful tasks before leaving or refreshing.',
    tasks: [
      {
        title: 'Find an action item',
        steps: [
          'Select Insights in the meeting toolbar to enable suggestions.',
          'Discuss a concrete task, for example: “Sam will send the agenda by Friday.”',
          'When a suggestion arrives, the Action items panel opens. Check the task, person, and any due date.',
        ],
        outcome:
          'Suggestions are based on spoken transcription and may be incomplete or wrong. An example sentence does not guarantee a suggestion.',
        troubleshooting:
          'If no suggestions appear, check whether spoken captions are arriving. The panel may be waiting for a task to be discussed. If speech captions also fail, ask the organiser to check transcription. Request errors appear in the Action items panel.',
      },
      {
        title: 'Edit, assign, and accept a suggestion',
        steps: [
          'Select Edit, update the task text, and press Enter or click away to save. Escape cancels your edit.',
          'Use Assign to to choose a participant for your local task list.',
          'Select Accept to move the task to Accepted. Expand Accepted to read it. Select Dismiss to remove an unwanted suggestion.',
        ],
        outcome:
          'Accept records your review locally; it does not send a task or notification. Accepted cards no longer offer edit or assignment controls, so review them before accepting.',
      },
      {
        title: 'Move, collapse, or stop insights',
        steps: [
          'Drag the Action items panel header to move it out of the way, or select Collapse action items.',
          'Select the Action items button to reopen it. Its badge counts unread suggestions.',
          'Select Insights again to stop new suggestions.',
        ],
        outcome:
          'Collapsing the panel does not stop suggestions. Turning Insights off retains the current list while the page remains open.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'After the meeting',
    description:
      'Read speech and recognised gesture text captured during your session and download a copy, with an optional AI summary.',
    requirement:
      'Notes are held on this page, not in a saved meeting history. Download before closing, refreshing, or navigating away. Notes are text, not an audio or video recording. Recognised gesture text is included; action items are not.',
    tasks: [
      {
        title: 'Download your transcript',
        steps: [
          'Select Leave in the meeting, then Leave Call.',
          'Review Full Transcript on the Transcript Summary screen.',
          'Select Download to save meeting-notes.txt. You do not need to generate a summary first.',
        ],
        outcome:
          'The file contains your session’s spoken transcript and any generated summary. Closing the browser tab instead of using Leave does not open this screen.',
        troubleshooting:
          'No transcript available means no speech or recognised gesture text was captured in your session. Generating a summary cannot recover missing content or content from before you joined.',
      },
      {
        title: 'Generate and save a summary',
        steps: [
          'Select Generate Summary and wait for Generating… to finish.',
          'Review AI Summary against Full Transcript. AI can omit or misinterpret details.',
          'Select Download after the summary arrives to include it in a new copy of meeting-notes.txt.',
          'After saving your notes, select Close to return to the home screen.',
        ],
        outcome:
          'The download contains both transcript and summary. A file downloaded before generation does not update automatically.',
        troubleshooting:
          'If summary generation fails, keep the transcript by selecting Download. You can retry Generate Summary while this page remains open.',
      },
    ],
  },
];

export const meetingHelp: readonly FeatureHelpContent[] = featureHelp
  .filter((feature) => feature.id !== 'notes')
  .map((feature) =>
    feature.id === 'basics'
      ? {
          ...feature,
          title: 'Meeting controls',
          tasks: feature.tasks.filter(
            (task) =>
              !['Create a meeting', 'Join an existing meeting'].includes(
                task.title,
              ),
          ),
        }
      : feature.id === 'insights'
        ? { ...feature, title: 'Insights' }
        : feature,
  );
