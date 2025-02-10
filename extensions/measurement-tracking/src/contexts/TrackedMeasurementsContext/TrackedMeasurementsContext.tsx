import React, { useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Machine } from 'xstate';
import { useMachine } from '@xstate/react';
import { useViewportGrid } from '@ohif/ui';
import { machineConfiguration, defaultOptions, RESPONSE } from './measurementTrackingMachine';
import promptBeginTracking from './promptBeginTracking';
import promptTrackNewSeries from './promptTrackNewSeries';
import promptTrackNewStudy from './promptTrackNewStudy';
import promptSaveReport from './promptSaveReport';
import promptHydrateStructuredReport from './promptHydrateStructuredReport';
import hydrateStructuredReport from './hydrateStructuredReport';
import { useAppConfig } from '@state';
import promptLabelAnnotation from './promptLabelAnnotation';

const TrackedMeasurementsContext = React.createContext();
TrackedMeasurementsContext.displayName = 'TrackedMeasurementsContext';
const useTrackedMeasurements = () => useContext(TrackedMeasurementsContext);

const SR_SOPCLASSHANDLERID = '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr';

/**
 *
 * @param {*} param0
 */
function TrackedMeasurementsContextProvider(
  { servicesManager, commandsManager, extensionManager }: withAppTypes, // Bound by consumer
  { children } // Component props
) {
  const [appConfig] = useAppConfig();

  const [viewportGrid, viewportGridService] = useViewportGrid();
  const { activeViewportId, viewports } = viewportGrid;
  const {
    measurementService,
    displaySetService,
    customizationService,
    cornerstoneViewportService,
  } = servicesManager.services;

  const machineOptions = Object.assign({}, defaultOptions);
  machineOptions.actions = Object.assign({}, machineOptions.actions, {
    jumpToFirstMeasurementInActiveViewport: (ctx, evt) => {
      const { trackedStudy, trackedSeries, activeViewportId } = ctx;
      const measurements = measurementService.getMeasurements();
      const trackedMeasurements = measurements.filter(
        m => trackedStudy === m.referenceStudyUID && trackedSeries.includes(m.referenceSeriesUID)
      );

      console.log(
        'jumping to measurement reset viewport',
        activeViewportId,
        trackedMeasurements[0]
      );

      const referencedDisplaySetUID = trackedMeasurements[0].displaySetInstanceUID;
      const referencedDisplaySet = displaySetService.getDisplaySetByUID(referencedDisplaySetUID);

      const referencedImages = referencedDisplaySet.images;
      const isVolumeIdReferenced = referencedImages[0].imageId.startsWith('volumeId');

      const measurementData = trackedMeasurements[0].data;

      let imageIndex = 0;
      if (!isVolumeIdReferenced && measurementData) {
        // if it is imageId referenced find the index of the imageId, we don't have
        // support for volumeId referenced images yet
        imageIndex = referencedImages.findIndex(image => {
          const imageIdToUse = Object.keys(measurementData)[0].substring(8);
          return image.imageId === imageIdToUse;
        });

        if (imageIndex === -1) {
          console.warn('Could not find image index for tracked measurement, using 0');
          imageIndex = 0;
        }
      }

      viewportGridService.setDisplaySetsForViewport({
        viewportId: activeViewportId,
        displaySetInstanceUIDs: [referencedDisplaySetUID],
        viewportOptions: {
          initialImageOptions: {
            index: imageIndex,
          },
          syncMeasurement: true,
        },
      });
    },

    jumpToSameImageInActiveViewport: (ctx, evt) => {
      const { trackedStudy, trackedSeries, activeViewportId } = ctx;
      console.log('📌 Checking Active Viewport ID:', activeViewportId);
      console.log('📌 Available Viewports:', cornerstoneViewportService.viewportsById);
      const measurements = measurementService.getMeasurements();
      const trackedMeasurements = measurements.filter(
        m => trackedStudy === m.referenceStudyUID && trackedSeries.includes(m.referenceSeriesUID)
      );
      const jumpToMeasurement = async () => {
        const trackedMeasurement = trackedMeasurements[0];

        if (!trackedMeasurement) {
          console.error('🚨 ERROR: No tracked measurements found.');
          return;
        }

        const referencedDisplaySetUID = trackedMeasurement.displaySetInstanceUID;

        // 🛠️ Try getting viewport ID from activeViewportId OR registered viewports
        let viewportIdToUse =
          activeViewportId || Object.keys(cornerstoneViewportService.viewportsById)[0];

        if (!viewportIdToUse) {
          console.error(
            '🚨 ERROR: No valid viewport ID found. Available viewports:',
            cornerstoneViewportService.viewportsById
          );
          return;
        }

        console.log('📌 Using Viewport ID:', viewportIdToUse);

        // 🛠️ Ensure viewport exists
        let viewport = cornerstoneViewportService.getCornerstoneViewport(viewportIdToUse);
        if (!viewport) {
          console.warn(`⚠️ Viewport not found for ID ${viewportIdToUse}. Retrying in 500ms...`);

          // Retry mechanism in case the viewport is delayed in registering
          let retries = 5;
          while (!viewport && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
            viewport = cornerstoneViewportService.getCornerstoneViewport(viewportIdToUse);
            retries--;
          }

          if (!viewport) {
            console.error(`🚨 ERROR: Viewport still not found after retries: ${viewportIdToUse}`);
            return;
          }
        }

        // 🛠️ Ensure getCurrentImageIdIndex exists
        if (!viewport.getCurrentImageIdIndex) {
          console.error(
            `🚨 ERROR: getCurrentImageIdIndex is not available on viewport ID ${viewportIdToUse}`
          );
          return;
        }

        // ✅ Successfully found viewport and image index
        const imageIndex = viewport.getCurrentImageIdIndex();
        console.log(`✅ Viewport Found! Jumping to Measurement at Index: ${imageIndex}`);

        // 🛠️ Finally, trigger the measurement display
        viewportGridService.setDisplaySetsForViewport({
          viewportId: viewportIdToUse,
          displaySetInstanceUIDs: [referencedDisplaySetUID],
          viewportOptions: {
            initialImageOptions: {
              index: imageIndex,
            },
          },
        });
      };

      jumpToMeasurement();
    },
    showStructuredReportDisplaySetInActiveViewport: (ctx, evt) => {
      if (evt.data.createdDisplaySetInstanceUIDs.length > 0) {
        const StructuredReportDisplaySetInstanceUID = evt.data.createdDisplaySetInstanceUIDs[0];

        viewportGridService.setDisplaySetsForViewport({
          viewportId: evt.data.viewportId,
          displaySetInstanceUIDs: [StructuredReportDisplaySetInstanceUID],
        });
      }
    },
    discardPreviouslyTrackedMeasurements: (ctx, evt) => {
      const measurements = measurementService.getMeasurements();
      const filteredMeasurements = measurements.filter(ms =>
        ctx.prevTrackedSeries.includes(ms.referenceSeriesUID)
      );
      const measurementIds = filteredMeasurements.map(fm => fm.id);

      for (let i = 0; i < measurementIds.length; i++) {
        measurementService.remove(measurementIds[i]);
      }
    },
    clearAllMeasurements: (ctx, evt) => {
      const measurements = measurementService.getMeasurements();
      const measurementIds = measurements.map(fm => fm.uid);

      for (let i = 0; i < measurementIds.length; i++) {
        measurementService.remove(measurementIds[i]);
      }
    },
  });
  machineOptions.services = Object.assign({}, machineOptions.services, {
    promptBeginTracking: promptBeginTracking.bind(null, {
      servicesManager,
      extensionManager,
      appConfig,
    }),
    promptTrackNewSeries: promptTrackNewSeries.bind(null, {
      servicesManager,
      extensionManager,
      appConfig,
    }),
    promptTrackNewStudy: promptTrackNewStudy.bind(null, {
      servicesManager,
      extensionManager,
      appConfig,
    }),
    promptSaveReport: promptSaveReport.bind(null, {
      servicesManager,
      commandsManager,
      extensionManager,
      appConfig,
    }),
    promptHydrateStructuredReport: promptHydrateStructuredReport.bind(null, {
      servicesManager,
      extensionManager,
      appConfig,
    }),
    hydrateStructuredReport: hydrateStructuredReport.bind(null, {
      servicesManager,
      extensionManager,
      appConfig,
    }),
    promptLabelAnnotation: promptLabelAnnotation.bind(null, {
      servicesManager,
      extensionManager,
    }),
  });
  machineOptions.guards = Object.assign({}, machineOptions.guards, {
    isLabelOnMeasure: (ctx, evt, condMeta) => {
      const labelConfig = customizationService.get('measurementLabels');
      return labelConfig?.labelOnMeasure;
    },
    isLabelOnMeasureAndShouldKillMachine: (ctx, evt, condMeta) => {
      const labelConfig = customizationService.get('measurementLabels');
      return evt.data && evt.data.userResponse === RESPONSE.NO_NEVER && labelConfig?.labelOnMeasure;
    },
  });

  // TODO: IMPROVE
  // - Add measurement_updated to cornerstone; debounced? (ext side, or consumption?)
  // - Friendlier transition/api in front of measurementTracking machine?
  // - Blocked: viewport overlay shouldn't clip when resized
  // TODO: PRIORITY
  // - Fix "ellipses" series description dynamic truncate length
  // - Fix viewport border resize
  // - created/destroyed hooks for extensions (cornerstone measurement subscriptions in it's `init`)

  const measurementTrackingMachine = Machine(machineConfiguration, {
    ...machineOptions,
    context: {
      ...machineOptions.context,
      syncMeasurements: true, // ✅ Ensure this is always set
    },
  });
  const [trackedMeasurements, sendTrackedMeasurementsEvent] = useMachine(
    measurementTrackingMachine
  );

  useEffect(() => {
    // Update the state machine with the active viewport ID
    sendTrackedMeasurementsEvent('UPDATE_ACTIVE_VIEWPORT_ID', {
      activeViewportId,
    });
  }, [activeViewportId, sendTrackedMeasurementsEvent]);

  // ~~ Listen for changes to ViewportGrid for potential SRs hung in panes when idle
  useEffect(() => {
    const triggerPromptHydrateFlow = async () => {
      console.log('📌 Checking Active Viewport for Measurement Hydration...');

      // Ensure activeViewportId is valid
      if (!activeViewportId) {
        console.error('🚨 ERROR: activeViewportId is undefined!');
        return;
      }

      let retries = 5;

      // Wait for viewport to be available
      while (!viewports.has(activeViewportId) && retries > 0) {
        console.warn(`⚠️ Viewport not found! Retrying in 500ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }

      if (retries === 0 && !viewports.has(activeViewportId)) {
        console.error(`🚨 ERROR: Viewport still not found after retries: ${activeViewportId}`);
        console.error('📌 Available Viewports:', viewports);
        return;
      }

      const activeViewport = viewports.get(activeViewportId);
      if (!activeViewport || !activeViewport?.displaySetInstanceUIDs?.length) {
        console.error(
          `🚨 ERROR: Viewport is undefined or has no display sets: ${activeViewportId}`
        );
        return;
      }

      console.log(`✅ Viewport Ready: ${activeViewportId}`, activeViewport);

      // Fetch DisplaySet
      const { displaySetService } = servicesManager.services;
      const displaySetUID = activeViewport.displaySetInstanceUIDs[0];
      console.log(`📌 Fetching DisplaySet for UID: ${displaySetUID}`);

      const displaySet = displaySetService.getDisplaySetByUID(displaySetUID);
      if (!displaySet) {
        console.error(`🚨 ERROR: DisplaySet not found for UID: ${displaySetUID}`);
        return;
      }

      console.log(`✅ Found DisplaySet:`, displaySet);

      // Load Structured Report if necessary
      if (
        displaySet.SOPClassHandlerId === SR_SOPCLASSHANDLERID &&
        !displaySet.isLoaded &&
        displaySet.load
      ) {
        console.log('📌 Loading DisplaySet for hydration...');
        await displaySet.load();
        console.log('✅ DisplaySet Loaded Successfully');
      }

      // Trigger SR Hydration if possible
      if (
        displaySet.SOPClassHandlerId === SR_SOPCLASSHANDLERID &&
        displaySet.isRehydratable === true
      ) {
        console.log(
          `📌 Triggering Measurement Hydration for UID: ${displaySet.displaySetInstanceUID}`
        );
        sendTrackedMeasurementsEvent('PROMPT_HYDRATE_SR', {
          displaySetInstanceUID: displaySet.displaySetInstanceUID,
          SeriesInstanceUID: displaySet.SeriesInstanceUID,
          viewportId: activeViewportId,
        });
      } else {
        console.warn('⚠️ DisplaySet is not rehydratable.');
      }
    };

    triggerPromptHydrateFlow();
  }, [
    trackedMeasurements,
    activeViewportId,
    sendTrackedMeasurementsEvent,
    servicesManager.services,
    viewports,
  ]);

  return (
    <TrackedMeasurementsContext.Provider
      value={[trackedMeasurements, sendTrackedMeasurementsEvent]}
    >
      {children}
    </TrackedMeasurementsContext.Provider>
  );
}

TrackedMeasurementsContextProvider.propTypes = {
  children: PropTypes.oneOf([PropTypes.func, PropTypes.node]),
  servicesManager: PropTypes.object.isRequired,
  commandsManager: PropTypes.object.isRequired,
  extensionManager: PropTypes.object.isRequired,
  appConfig: PropTypes.object,
};

export { TrackedMeasurementsContext, TrackedMeasurementsContextProvider, useTrackedMeasurements };
