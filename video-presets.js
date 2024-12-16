/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-0
 * Released: 12/14/24
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
          name: 'Pres: 2,3 Floating SelfView LL',
          Selfview:{
            FullscreenMode: 'Off',
            Mode: 'On',
            OnMonitorRole:'First',
            PIPPosition: 'LowerLeft'
          },
          MainVideoSource: {
            SourceId: [1, 2],
            Layout: 'Equal'
          },
          LayoutName: 'Floating',
          Presentations: [
            {
              PresentationSource: [2],
              Layout: 'Equal',
              SendingMode: 'LocalRemote'
            },
            {
              PresentationSource: [3],
              Layout: 'Equal',
              SendingMode: 'LocalOnly'
            }
          ]
        },
        {
          name: 'Pres: 3,2 Floating SelfView UL',
          Selfview:{
            FullscreenMode: 'Off',
            Mode: 'On',
            OnMonitorRole:'First',
            PIPPosition: 'UpperLeft'
          },
          MainVideoSource: {
            SourceId: [1, 2],
            Layout: 'Equal'
          },
          LayoutName: 'Floating',
          Presentations: [
            {
              PresentationSource: [3],
              Layout: 'Equal',
              SendingMode: 'LocalRemote'
            },
            {
              PresentationSource: [2],
              Layout: 'Equal',
              SendingMode: 'LocalOnly'
            }
          ]
        },
         {
          name: 'Pres: 2 Layout: Focus',
          Selfview:{
            FullscreenMode: 'Off',
            Mode: 'On',
            OnMonitorRole:'First',
            PIPPosition: 'UpperLeft'
          },
          MainVideoSource: {
            SourceId: [1, 2],
            Layout: 'Equal'
          },
          LayoutName: 'Focus',
          Presentations: [
            {
              PresentationSource: [2],
              Layout: 'Equal',
              SendingMode: 'LocalOnly'
            }
          ]
        }
      ]
    }
  ],
  panelId: 'videoPresets'
}

/*********************************************************
 * Do not change below
**********************************************************/

let currentLayout;
let callId = null;


init();

async function init() {

  // Identify Video Outputs
  const outputs = await xapi.Status.Video.Output.Connector.get();
  console.log('outputs', outputs.length);

  await createPanel();

  xapi.Status.Video.Layout.CurrentLayouts.AvailableLayouts.on(layout => {
    if (layout.ghost) return
    if (currentLayout != layout.LayoutName) return
    setLayout(currentLayout)
  })


  xapi.Status.Call.on(({ ghost, AnswerState, id }) => {
    if (AnswerState && AnswerState == 'Answered' && callId != id) return processCallStart(id);
    if (ghost && callId) return processCallEnd(id);
  })

  xapi.Event.UserInterface.Extensions.Widget.Action.on(async ({ Type, WidgetId, Value }) => {
    console.debug('Widget Action, Type:', Type, '- Widgetid:', WidgetId, '- Value:', Value)
    if (!WidgetId.startsWith(config.panelId)) return
    if (Type != 'pressed') return

    const [_panelId, pageNumber] = WidgetId.split('-');
    const matchedLayout = config.pages?.[pageNumber].options?.[Value]

    console.log('matched layout:', matchedLayout)

    const { MainVideoSource, Presentations, LayoutName } = matchedLayout;

    if (LayoutName) setLayout(LayoutName)
    if (MainVideoSource) setMainVideoSource(MainVideoSource)
    if (Presentations) setPresentations(Presentations)

  });

}


function setMainVideoSource(sendingVideo) {
  console.log('Setting Main Video Source:', sendingVideo)
  xapi.Command.Video.Input.SetMainVideoSource(sendingVideo);
}


async function setPresentations(presentations) {
  await xapi.Command.Presentation.Stop();

  presentations.forEach((presentation, index) => {
    setTimeout(async () => {
      console.log('Starting Presentation:', presentation)
      await xapi.Command.Presentation.Start({ ...presentation, Instance: index + 1 })
    }, 200 * (index + 1))
  })

}



function setLayout(layoutName) {
  currentLayout = layoutName;
  console.log('Setting layout to:', layoutName)
  xapi.Command.Video.Layout.SetLayout({ LayoutName: layoutName }).catch(()=>console.debug('Could not set layout:', layoutName))
}





function createButtonGroup(options, index) {
  const values = options.map((option, index) => {
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

  const panelId = config.panelId;
  const button = config.button;
  const order = await panelOrder(panelId)

  const pages = config.pages.map((page, index) =>
    createPage(page.name, createRow(createButtonGroup(page.options, index)), index))

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
