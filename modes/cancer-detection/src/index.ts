import toolbarButtons from './toolbarButtons.js';
import { hotkeys } from '@ohif/core';
import { id } from './id';
import i18n from 'i18next';
const configs = {
  Length: {},
  //
};

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  thumbnailList: '@ohif/extension-default.panelModule.seriesList',
  measurements: '@ohif/extension-default.panelModule.measurements',
};

const cs3d = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const dicomsr = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr',
  viewport: '@ohif/extension-cornerstone-dicom-sr.viewportModule.dicom-sr',
};

const dicomvideo = {
  sopClassHandler: '@ohif/extension-dicom-video.sopClassHandlerModule.dicom-video',
  viewport: '@ohif/extension-dicom-video.viewportModule.dicom-video',
};

const dicompdf = {
  sopClassHandler: '@ohif/extension-dicom-pdf.sopClassHandlerModule.dicom-pdf',
  viewport: '@ohif/extension-dicom-pdf.viewportModule.dicom-pdf',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-sr': '^3.0.0',
  '@ohif/extension-dicom-pdf': '^3.0.1',
  '@ohif/extension-dicom-video': '^3.0.1',
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

const measurementTracking = {
  trackedMeasurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  seriesList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  gbcPanel: '@ohif/extension-measurement-tracking.panelModule.gbcPanel',
  MammoPanel: '@ohif/extension-measurement-tracking.panelModule.MammoPanel',
  XRayPanel: '@ohif/extension-measurement-tracking.panelModule.XRayPanel',
};
function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 'cancer-detection',
    displayName: i18n.t('Modes:Cancer Detection'),
    /**
     * Lifecycle hooks
     */
    onModeEnter: ({ servicesManager, extensionManager }: withAppTypes) => {
      const { toolbarService, toolGroupService } = servicesManager.services;
      const utilityModule = extensionManager.getModuleEntry(
        '@ohif/extension-cornerstone.utilityModule.tools'
      );

      const { toolNames, Enums } = utilityModule.exports;

      const tools = {
        active: [
          {
            toolName: toolNames.WindowLevel,
            bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
          },
          {
            toolName: toolNames.Pan,
            bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }],
          },
          {
            toolName: toolNames.Zoom,
            bindings: [{ mouseButton: Enums.MouseBindings.Secondary }],
          },
          { toolName: toolNames.StackScrollMouseWheel, bindings: [] },
        ],
        passive: [
          { toolName: toolNames.Length },
          { toolName: toolNames.Bidirectional },
          { toolName: toolNames.Probe },
          { toolName: toolNames.EllipticalROI },
          { toolName: toolNames.CircleROI },
          { toolName: toolNames.RectangleROI },
          { toolName: toolNames.StackScroll },
          { toolName: toolNames.CalibrationLine },
        ],
        // enabled
        enabled: [{ toolName: toolNames.ImageOverlayViewer }],
        // disabled
      };

      toolGroupService.createToolGroupAndAddTools('default', tools);

      toolbarService.addButtons(toolbarButtons);
      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'Layout',
        'MoreTools',
      ]);
    },
    onModeExit: ({ servicesManager }: withAppTypes) => {
      const {
        toolGroupService,
        measurementService,
        toolbarService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;
      uiDialogService.dismissAll();
      uiModalService.hide();
      toolGroupService.destroy();
    },
    validationTags: {
      study: [],
      series: [],
    },
    isValidMode: ({ modalities }) => {
      const modalities_list = modalities.split('\\');

      // Slide Microscopy modality not supported by basic mode yet
      return {
        valid: !modalities_list.includes('SM'),
        description: 'The mode does not support the following modalities: SM',
      };
    },
    routes: [
      {
        path: 'viewer-cs3d',
        /*init: ({ servicesManager, extensionManager }) => {
          //defaultViewerRouteInit
        },*/
        layoutTemplate: ({ location, servicesManager }) => {
          const { displaySetService } = servicesManager.services;
          const studyMetadata = displaySetService.getActiveDisplaySets()[0];
          const modality = studyMetadata ? studyMetadata.Modality : 'Mammo'; // Default to Mammo
          console.log('📸 Detected Modality:', modality);
          return {
            id: ohif.layout,
            props: {
              // TODO: Should be optional, or required to pass empty array for slots?
              leftPanels: [ohif.thumbnailList],
              rightPanels: [
                measurementTracking.MammoPanel,
                measurementTracking.gbcPanel,
                measurementTracking.XRayPanel,
                measurementTracking.trackedMeasurements,
                measurementTracking.seriesList,
                ohif.measurements,
              ],
              viewports: [
                {
                  namespace: cs3d.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: dicomvideo.viewport,
                  displaySetsToDisplay: [dicomvideo.sopClassHandler],
                },
                {
                  namespace: dicompdf.viewport,
                  displaySetsToDisplay: [dicompdf.sopClassHandler],
                },
                {
                  namespace: dicomsr.viewport, // Ensure SRs are mapped
                  displaySetsToDisplay: [dicomsr.sopClassHandler],
                  viewportOptions: {
                    syncMeasurements: true,
                  },
                },
              ],
            },
          };
        },
      },
    ],
    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [
      dicomvideo.sopClassHandler,
      ohif.sopClassHandler,
      dicompdf.sopClassHandler,
      dicomsr.sopClassHandler,
    ],
    hotkeys: [...hotkeys.defaults.hotkeyBindings],
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
