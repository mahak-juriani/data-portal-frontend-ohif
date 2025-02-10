import { hydrateStructuredReport } from '@ohif/extension-cornerstone-dicom-sr';

const RESPONSE = {
  NO_NEVER: -1,
  CANCEL: 0,
  CREATE_REPORT: 1,
  ADD_SERIES: 2,
  SET_STUDY_AND_SERIES: 3,
  NO_NOT_FOR_SERIES: 4,
  HYDRATE_REPORT: 5,
};

function promptHydrateStructuredReport({ servicesManager, extensionManager, appConfig }, ctx, evt) {
  const { displaySetService } = servicesManager.services;
  const { viewportId, displaySetInstanceUID } = evt;
  const srDisplaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
  console.log('💡 Running Structured Report Hydration...');

  return new Promise(function (resolve) {
    // Directly hydrate the structured report without any user prompt
    console.warn('!! HYDRATING STRUCTURED REPORT');
    const hydrationResult = hydrateStructuredReport(
      { servicesManager, extensionManager, appConfig },
      displaySetInstanceUID
    );

    const { StudyInstanceUID, SeriesInstanceUIDs } = hydrationResult;

    resolve({
      userResponse: RESPONSE.HYDRATE_REPORT,
      displaySetInstanceUID: evt.displaySetInstanceUID,
      srSeriesInstanceUID: srDisplaySet.SeriesInstanceUID,
      viewportId,
      StudyInstanceUID,
      SeriesInstanceUIDs,
    });
  });
}

export default promptHydrateStructuredReport;
