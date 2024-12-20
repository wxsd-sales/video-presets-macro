/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-1
 * Released: 12/20/24
 * 
 * This is an example macro which automatically applies customised 
 * video presets (presentations, layouts, selview)
 * 
 * Full Readme, source code and license details for this macro are available 
 * on Github: https://github.com/wxsd-sales/video-presets-macro
 * 
 ********************************************************/
import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  button: {
    name: 'Video Presets',
    color: '#f58142',
    icon: 'Sliders'
  },
  pages: [
    {
      name: 'Video Presets',
      options: [
        {
          name: 'S1.1: Dual Presentation [3][4][3]',
          inCall: false,
          Selfview: {
            Mode: 'Off'
          },
          Presentations: [
            {
              PresentationSource: [2], // 3
              SendingMode: 'LocalOnly'
            },
            {
              PresentationSource: [3], // 4
              SendingMode: 'LocalOnly'
            }
          ],
          MonitorRoles: ['First', 'Second', 'First']
        },
        {
          name: 'S1.2: Triple Presentation [3][4][5]',
          inCall: false,
          Selfview: {
            Mode: 'Off'
          },
          Presentations: [
            {
              PresentationSource: [2], // 3
              SendingMode: 'LocalOnly'
            },
            {
              PresentationSource: [3], // 4
              SendingMode: 'LocalOnly'
            },
            {
              PresentationSource: [7], // 5
              SendingMode: 'LocalOnly'
            }
          ],
          MonitorRoles: ['First', 'Second', 'Third']
        },
        {
          name: 'S2.1: Triple Presentation [L3][L4][S5]',
          inCall: true,
          Selfview: {
            Mode: 'Off',
          },
          MainVideoSource: {
            SourceId: [1],
            Layout: 'Equal'
          },
          LayoutName: 'Floating',
          ActiveSpeakerPIPPosition: 'UpperRight',
          Presentations: [
            {
              PresentationSource: [7], // 5
              SendingMode: 'LocalRemote'
            }
          ],
          MonitorRoles: ['Third', 'Second', 'First'],
          VideoMonitors: 'Single',
          VideoMatrix: [
            { Layout: 'Equal', Output: 1, SourceId: 2 },
            { Layout: 'Equal', Output: 2, SourceId: 3 }
          ]
        },
        {
          name: 'S2.2: Triple Presentation [L3][L4][S345]',
          inCall: true,
          Selfview: { Mode: 'Off' },
          MainVideoSource: {
            SourceId: [1],
            Layout: 'Equal'
          },
          LayoutName: 'Floating',
          ActiveSpeakerPIPPosition: 'LowerRight',
          Presentations: [
            {
              PresentationSource: [2, 3, 7, 6], // 3,4,5
              SendingMode: 'LocalRemote'
            }
          ],
          MonitorRoles: ['Third', 'Second', 'First'],
          VideoMonitors: 'Single',
          VideoMatrix: [
            { Layout: 'Equal', Output: 1, SourceId: 2 },
            { Layout: 'Equal', Output: 2, SourceId: 3 }
          ]
        },
        {
          name: 'S3: Receiving Presentation [RV][RC][RV]',
          inCall: true,
          MainVideoSource: {
            SourceId: [1],
            Layout: 'Equal'
          },
          Selfview: { FullscreenMode: 'Off', Mode: 'On', OnMonitorRole: 'First', PIPPosition: 'UpperRight' },
          LayoutName: 'Focus',
          ActiveSpeakerPIPPosition: 'UpperRight',
          MonitorRoles: ['First', 'Second', 'First'],
          VideoMonitors: 'Auto'
        },
      ]
    },

  ],
  panelId: 'videoPresets'
}

/*********************************************************
 * Do not change below
**********************************************************/

let currentLayout;
let activeSpeakerPIPPosition;
let currentSelfView;

init();

async function init() {

  await createPanel();

  // Monitor Available Layouts and Apply currently selected Layout
  xapi.Status.Video.Layout.CurrentLayouts.AvailableLayouts.on(layout => {
    if (layout.ghost) return
    if (currentLayout != layout.LayoutName) return
    setLayout(currentLayout)
  })


  xapi.Status.Video.ActiveSpeaker.PIPPosition.on(value => {
    console.log('Active Speaker PIP Position changed to:', value)
    if (!activeSpeakerPIPPosition) return
    if (activeSpeakerPIPPosition == value) return
    setActiveSpeakerPIP(activeSpeakerPIPPosition);
  })

  xapi.Status.Video.Selfview.PIPPosition.on(value => {
    console.log('Selfview PIP Position changed to:', value)

    const pipPosition = currentSelfView?.PIPPosition
    if (!pipPosition) return
    if (pipPosition == value) return

    setSelfView(currentSelfView);
  })

  xapi.Status.Call.on(({ ghost, Status }) => {
    if (Status && Status == 'Connected') return createPanel();
    if (ghost) return createPanel();
  })

  xapi.Status.Conference.Presentation.Mode.on(async value => {
    console.log('Presentation State Change:', value);
    if (value != 'Receiving') return
    const options = config.pages?.[0].options;
    const matchedLayout = options[options.length - 1]
    console.log('Presentation Receive Detected,  activting default layout')
    setVideoPreset(matchedLayout);
    const widgetId = config.panelId + '-0';
    const newValue = options.length - 1;
    console.log('Setting WidgetId:', widgetId, ' to value:', newValue)
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: newValue, WidgetId: widgetId });

  });

  xapi.Event.UserInterface.Extensions.Widget.Action.on(async ({ Type, WidgetId, Value }) => {
    console.debug('Widget Action, Type:', Type, '- Widgetid:', WidgetId, '- Value:', Value)
    if (!WidgetId.startsWith(config.panelId)) return
    if (Type != 'pressed') return
    const [_panelId, pageNumber] = WidgetId.split('-');
    const matchedLayout = config.pages?.[pageNumber].options?.[Value]
    console.log('Matched Selected Layout:', matchedLayout)
    setVideoPreset(matchedLayout)
  });
}

async function setVideoPreset(layout) {

  const {
    MainVideoSource,
    Presentations,
    LayoutName,
    MonitorRoles,
    VideoMatrix,
    ActiveSpeakerPIPPosition,
    VideoMonitors,
    Selfview
  } = layout;

  await resetVideoMatrix();

  if (VideoMatrix) await sleep(200).then(() => setVideoMatrix(VideoMatrix))
  if (MonitorRoles) await sleep(200).then(() => setMonitorRoles(MonitorRoles))
  if (VideoMonitors) await sleep(200).then(() => setVideoMonitors(VideoMonitors))
  if (LayoutName) await sleep(200).then(() => setLayout(LayoutName))
  if (MainVideoSource) await sleep(200).then(() => setMainVideoSource(MainVideoSource))
  if (Presentations) await sleep(200).then(() => setPresentations(Presentations))
  if (ActiveSpeakerPIPPosition) await sleep(200).then(() => setActiveSpeakerPIP(ActiveSpeakerPIPPosition))

  await setSelfView(Selfview)



}

async function setMonitorRoles(monitorRoles) {
  console.log('Setting Monitor Roles:', monitorRoles)

  for (let i = 0; i < monitorRoles.length; i++) {
    await xapi.Config.Video.Output.Connector[i + 1].MonitorRole.set(monitorRoles[i]);

  }
}

function setSelfView(selfview) {
  if (!setSelfView) {
    currentSelfView = null;
    console.log('Removing SelfView')
    return xapi.Command.Video.Selfview.Set({ Mode: 'Off' });
  }
  currentSelfView = selfview;
  console.log('Setting SelfView:', selfview)
  return xapi.Command.Video.Selfview.Set(selfview);
}

function setVideoMonitors(videoMonitors) {
  console.log('Setting Video Monitors:', videoMonitors)
  return xapi.Config.Video.Monitors.set(videoMonitors);
}

async function setVideoMatrix(videoMatrix) {
  console.log('Setting Video Matrix:', videoMatrix)
  for (let i = 0; i < videoMatrix.length; i++) {
    await xapi.Command.Video.Matrix.Assign(videoMatrix[i]);
  }
}

async function checkInCall() {
  const call = await xapi.Status.Call.get();
  return call?.[0]?.Status == 'Connected'
}

async function resetVideoMatrix() {
  const outputs = await xapi.Status.Video.Output.get();
  const connectors = outputs.Connector;
  for (let i = 0; i < connectors.length; i++) {
    console.log('Resetting Video Matrix On Output:', connectors[i].id)
    await xapi.Command.Video.Matrix.Reset({ Output: connectors[i].id });
  }
}

async function setActiveSpeakerPIP(activeSpeaker) {
  activeSpeakerPIPPosition = activeSpeaker
  console.log('Setting Active Speaker PIP:', activeSpeaker)
  return xapi.Command.Video.ActiveSpeakerPIP.Set({ Position: activeSpeaker });
}


function setMainVideoSource(sendingVideo) {
  console.log('Setting Main Video Source:', sendingVideo)
  return xapi.Command.Video.Input.SetMainVideoSource(sendingVideo);
}


async function setPresentations(presentations) {
  await xapi.Command.Presentation.Stop();
  await sleep(200)

  for (let i = 0; i < presentations.length; i++) {
    const presentation = presentations[i];
    console.log('Starting Presentation:', presentation)
    await xapi.Command.Presentation.Start({ ...presentation, Instance: i + 1 })
    await sleep(200)
  }
}


function setLayout(layoutName) {
  currentLayout = layoutName;
  console.log('Setting layout to:', layoutName)
  xapi.Command.Video.Layout.SetLayout({ LayoutName: layoutName }).catch(() => console.debug('Could not set layout:', layoutName))
}

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function createButtonGroup(options, index, inCall) {
  const values = options.map((option, index) => {
    if (inCall && !option.inCall) return ''
    if (!inCall && option.inCall) return ''
    return `<Value><Key>${index}</Key><Name>${option.name}</Name></Value>`
  });

  return `<Widget>
          <WidgetId>${config.panelId}-${index}</WidgetId>
          <Type>GroupButton</Type>
          <Options>size=4;columns=1</Options>
          <ValueSpace>
            ${values}
          </ValueSpace>
        </Widget>`
}

function createRow(widgets) {
  return `<Row>${widgets}</Row>`
}

function createPage(name, rows, index) {
  return ` <Page><Name>${name}</Name>${rows}
            <PageId>${config.panelId}-${index}</PageId>
            <Options>hideRowNames=1</Options></Page>`
}

async function createPanel() {
  console.log('Creating Panel')
  const panelId = config.panelId;
  const button = config.button;
  const order = await panelOrder(panelId);
  const inCall = await checkInCall();

  const pages = config.pages.map((page, index) =>
    createPage(page.name, createRow(createButtonGroup(page.options, index, inCall)), index))

  const panel = `
    <Extensions>
      <Panel>
        <Origin>local</Origin>
        <Location>HomeScreenAndCallControls</Location>
        <Icon>${button.icon}</Icon>
        <Color>${button.color}</Color>
        <Name>${button.name}</Name>
        ${order}
        <ActivityType>Custom</ActivityType>
        ${pages}
      </Panel>
    </Extensions>`;

  return xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel);
}


async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({ ActivityType: "Custom" });
  const panels = list?.Extensions?.Panel
  if (!panels) return ''
  const existingPanel = panels.find(panel => panel.PanelId == panelId)
  if (!existingPanel) return ''
  return `<Order>${existingPanel.Order}</Order>`
}
