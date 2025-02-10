import React, { useState } from 'react';
import { Select, Icon, Dropdown, Tooltip } from '../../components';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { globalServicesManager as servicesManager } from '../../../../app/src/appInit';
import {
  Types,
  Enums,
  getEnabledElementByViewportId,
  VolumeViewport,
  utilities,
  StackViewport,
  imageLoader,
} from '@cornerstonejs/core';
import { utilities as csUtils } from '@cornerstonejs/core';
import { eventTarget, EVENTS } from '@cornerstonejs/core';
import {
  Enums as csToolsEnums,
  segmentation as cstSegmentation,
  Types as cstTypes,
  utilities as cstUtils,
} from '@cornerstonejs/tools';

// import App, { commandsManager, extensionManager, servicesManager } from '../../../../app/src/App';
function SegmentationDropDownRow({
  segmentations = [],
  activeSegmentation,
  onActiveSegmentationChange,
  disableEditing = false,
  onToggleSegmentationVisibility,
  onSegmentationEdit,
  onSegmentationDownload,
  onSegmentationDownloadRTSS,
  storeSegmentation,
  onSegmentationDelete,
  onSegmentationAdd,
  addSegmentationClassName,
}) {
  const handleChange = option => {
    onActiveSegmentationChange(option.value); // Notify the parent
  };

  const [loading, setLoading] = useState(false);
  // const [loading2, setLoading2] = useState(false);

  const handleClick = async () => {
    setLoading(true);

    console.log('servicesManager:', servicesManager);

    if (!servicesManager || !servicesManager.services) {
      console.error('servicesManager or servicesManager.services is undefined');
      setLoading(false);
      return;
    }

    const { segmentationService, viewportGridService } = servicesManager.services;
    const { activeViewportId } = viewportGridService.getState();
    const { viewport } = getEnabledElementByViewportId(activeViewportId) || {};
    const imageId = viewport.getCurrentImageId();
    const sliceID = viewport.getCurrentImageIdIndex();

    const segmentationId = activeSegmentation.id;

    // Continue with segmentation logic...
    const labelmapVolume = segmentationService.getLabelmapVolume(segmentationId);
    const { dimensions } = labelmapVolume;
    const scalarData = labelmapVolume.getScalarData();
    const width = dimensions[0];
    const height = dimensions[1];
    const startIndex = sliceID * width * height;
    const slicedData = scalarData.slice(startIndex, startIndex + width * height);

    console.log(`imageID: ${imageId}  sliceID: ${sliceID}`);
    console.log(`Seg_ID: ${segmentationId}`);

    try {
      const image = await imageLoader.loadAndCacheImage(imageId);
      const pixelData = image.getPixelData(); // Uint16Array or Int16Array

      // Convert pixelData to a regular array for transmission
      const pixelDataArray = Array.from(pixelData);
      const old_seg_data_array = Array.from(slicedData);

      // Send pixelData and imageId in the POST request
      const response = await fetch('http://localhost:8000/api/segment-image-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelData: pixelDataArray, old_seg_data: old_seg_data_array }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.statusText);
      }

      const { segmentation_data } = await response.json();
      console.log('Segmentation Data:', segmentation_data);

      // Check if segmentation_data matches the expected size
      if (segmentation_data.length !== width * height) {
        console.error(
          `Segmentation data size (${segmentation_data.length}) does not match labelmap dimensions (${width * height})`
        );
        return;
      }

      // Update the scalar data with the new segmentation data
      for (let i = 0; i < segmentation_data.length; i++) {
        scalarData[startIndex + i] = segmentation_data[i];
      }

      const updatedSegmentSlice = scalarData.slice(startIndex, startIndex + width * height);
      console.log('Updated Segment Slice:', updatedSegmentSlice);

      // Notify about the segmentation data modification
      const eventDetail = { segmentationId: segmentationId };
      const event = new CustomEvent(csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED, {
        detail: eventDetail,
      });
      eventTarget.dispatchEvent(event);

      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (segmentation === undefined) {
        console.error('Segmentation not found!');
        return;
      }

      segmentationService._broadcastEvent(segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED, {
        segmentation,
      });
    } catch (error) {
      console.error('Error fetching segmentation data:', error);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  const handleClick2 = async () => {
    setLoading(true);

    if (!servicesManager || !servicesManager.services) {
      console.error('servicesManager or servicesManager.services is undefined');
      setLoading(false);
      return;
    }

    const { segmentationService, viewportGridService } = servicesManager.services;
    const { activeViewportId } = viewportGridService.getState();
    const { viewport } = getEnabledElementByViewportId(activeViewportId) || {};
    const imageId = viewport.getCurrentImageId();
    const sliceID = viewport.getCurrentImageIdIndex();

    const segmentationId = activeSegmentation.id;

    console.log(`imageID: ${imageId}  sliceID: ${sliceID}`);
    console.log(`Seg_ID: ${segmentationId}`);

    try {
      const image = await imageLoader.loadAndCacheImage(imageId);
      const pixelData = image.getPixelData(); // Uint16Array or Int16Array

      // Convert pixelData to a regular array for transmission
      const pixelDataArray = Array.from(pixelData);

      // Send pixelData and imageId in the POST request
      const response = await fetch('http://localhost:8000/api/segment-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelData: pixelDataArray }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.statusText);
      }

      const { segmentation_data } = await response.json();
      console.log('Segmentation Data:', segmentation_data);

      // Continue with segmentation logic...
      const labelmapVolume = segmentationService.getLabelmapVolume(segmentationId);
      const { dimensions } = labelmapVolume;
      const scalarData = labelmapVolume.getScalarData();
      const width = dimensions[0];
      const height = dimensions[1];

      // Check if segmentation_data matches the expected size
      if (segmentation_data.length !== width * height) {
        console.error(
          `Segmentation data size (${segmentation_data.length}) does not match labelmap dimensions (${width * height})`
        );
        return;
      }

      const startIndex = sliceID * width * height;

      // Update the scalar data with the new segmentation data
      for (let i = 0; i < segmentation_data.length; i++) {
        scalarData[startIndex + i] = segmentation_data[i];
      }

      const updatedSegmentSlice = scalarData.slice(startIndex, startIndex + width * height);
      console.log('Updated Segment Slice:', updatedSegmentSlice);

      // Notify about the segmentation data modification
      const eventDetail = { segmentationId: segmentationId };
      const event = new CustomEvent(csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED, {
        detail: eventDetail,
      });
      eventTarget.dispatchEvent(event);

      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (segmentation === undefined) {
        console.error('Segmentation not found!');
        return;
      }

      segmentationService._broadcastEvent(segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED, {
        segmentation,
      });
    } catch (error) {
      console.error('Error fetching segmentation data:', error);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  const selectOptions = segmentations.map(s => ({
    value: s.id,
    label: s.label,
  }));
  const { t } = useTranslation('SegmentationTable');

  if (!activeSegmentation) {
    return null;
  }

  return (
    <div className="group mx-0.5 mt-[8px] flex items-center pb-[10px]">
      <div
        onClick={e => {
          e.stopPropagation();
        }}
      >
        <Dropdown
          id="segmentation-dropdown"
          showDropdownIcon={false}
          alignment="left"
          itemsClassName={`text-primary-active ${addSegmentationClassName}`}
          showBorders={false}
          maxCharactersPerLine={30}
          list={[
            ...(!disableEditing
              ? [
                  {
                    title: t('Add new segmentation'),
                    onClick: () => {
                      onSegmentationAdd();
                    },
                  },
                ]
              : []),
            ...(!disableEditing
              ? [
                  {
                    title: t('Rename'),
                    onClick: () => {
                      onSegmentationEdit(activeSegmentation.id);
                    },
                  },
                ]
              : []),
            {
              title: t('Delete'),
              onClick: () => {
                onSegmentationDelete(activeSegmentation.id);
              },
            },
            ...(!disableEditing
              ? [
                  {
                    title: t('Export DICOM SEG'),
                    onClick: () => {
                      storeSegmentation(activeSegmentation.id);
                    },
                  },
                ]
              : []),
            ...[
              {
                title: t('Download DICOM SEG'),
                onClick: () => {
                  onSegmentationDownload(activeSegmentation.id);
                },
              },
              {
                title: t('Download DICOM RTSTRUCT'),
                onClick: () => {
                  onSegmentationDownloadRTSS(activeSegmentation.id);
                },
              },
            ],
          ]}
        >
          <div className="hover:bg-secondary-dark grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]">
            <Icon name="icon-more-menu"></Icon>
          </div>
        </Dropdown>
      </div>
      {selectOptions?.length && (
        <Select
          id="segmentation-select"
          isClearable={false}
          onChange={handleChange}
          components={{
            DropdownIndicator: () => (
              <Icon
                name={'chevron-down-new'}
                className="mr-2"
              />
            ),
          }}
          isSearchable={false}
          options={selectOptions}
          value={selectOptions?.find(o => o.value === activeSegmentation.id)}
          className="text-aqua-pale h-[26px] w-1/2 text-[13px]"
        />
      )}
      <div className="flex items-center">
        <Tooltip
          position="bottom-right"
          content={
            <div className="flex flex-col">
              <div className="text-[13px] text-white">Series:</div>
              <div className="text-aqua-pale text-[13px]">{activeSegmentation.description}</div>
            </div>
          }
        >
          <Icon
            name="info-action"
            className="text-primary-active"
          />
        </Tooltip>
        <div
          className="hover:bg-secondary-dark mr-1 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-[4px]"
          onClick={() => onToggleSegmentationVisibility(activeSegmentation.id)}
        >
          {activeSegmentation.isVisible ? (
            <Icon
              name="row-shown"
              className="text-primary-active"
            />
          ) : (
            <Icon
              name="row-hidden"
              className="text-primary-active"
            />
          )}
        </div>

        {/* New Button */}
        <div
          className={`h-[10px] w-[14px] hover:cursor-pointer ${
            loading ? 'pointer-events-none opacity-50' : 'hover:opacity-60'
          }`}
          onClick={e => {
            e.stopPropagation();
            if (!loading) {
              handleClick(); // Call the new action handler
            }
          }}
        >
          <svg
            fill="#5ccaed"
            height="17px"
            width="17px"
            version="1.1"
            id="Icons"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 32 32"
            xmlSpace="preserve"
          >
            <g>
              <path
                d="M16.5,19.9C16.5,19.9,16.5,19.9,16.5,19.9l3.1-3.1c0,0,0,0,0,0l2.3-2.3c2.2,0.6,4.5,0,6.2-1.6c1.8-1.8,2.3-4.4,1.4-6.8
                    c-0.1-0.3-0.4-0.5-0.7-0.6c-0.3-0.1-0.7,0-0.9,0.3L25.6,8l-1.3-0.3L24,6.4l2.2-2.2c0.2-0.2,0.3-0.6,0.3-0.9
                    c-0.1-0.3-0.3-0.6-0.6-0.7c-2.3-0.9-5-0.4-6.8,1.4c-1.6,1.6-2.2,4-1.6,6.2l-1.6,1.6l-2.6-2.6L11,5.3c-0.1-0.1-0.2-0.3-0.3-0.3
                    L6.8,2.7C6.4,2.4,5.9,2.5,5.5,2.8L2.5,5.9C2.1,6.2,2.1,6.7,2.3,7.1L4.6,11c0.1,0.1,0.2,0.3,0.3,0.3l3.7,2.2l2.6,2.6l-1.2,1.2
                    c-2.2-0.6-4.5,0-6.2,1.6c-1.8,1.8-2.3,4.4-1.4,6.8c0.1,0.3,0.4,0.5,0.7,0.6c0.3,0.1,0.7,0,0.9-0.3L6.4,24l1.3,0.3L8,25.6l-2.2,2.2
                    c-0.2,0.2-0.3,0.6-0.3,0.9c0.1,0.3,0.3,0.6,0.6,0.7c0.8,0.3,1.5,0.4,2.3,0.4c1.6,0,3.3-0.6,4.5-1.9c1.6-1.6,2.2-4,1.6-6.2
                    L16.5,19.9z"
              />
              <path d="M22.5,16.8l-6,6l6.1,6.1c0.8,0.8,1.9,1.3,3,1.3s2.2-0.4,3-1.3c0.8-0.8,1.3-1.9,1.3-3c0-1.1-0.4-2.2-1.3-3L22.5,16.8z" />
            </g>
          </svg>
        </div>

        {/* New Button 2222 */}
        <div
          className={`h-[10px] w-[14px] hover:cursor-pointer ${
            loading ? 'pointer-events-none opacity-50' : 'hover:opacity-60'
          } mr-2 ml-2`}
          onClick={e => {
            e.stopPropagation();
            if (!loading) {
              handleClick2(); // Call the action handler
            }
          }}
        >
          <svg
            fill="#5ccaed"
            height="17px"
            width="17px"
            version="1.1"
            id="Icons"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 32 32"
            xmlSpace="preserve"
          >
            <path
              d="M28.7,6.7c-0.1-0.3-0.4-0.5-0.7-0.6c-0.3-0.1-0.7,0-0.9,0.3l-2,2l-1.1-0.3L23.6,7l2-2c0.2-0.2,0.3-0.6,0.3-0.9
              c-0.1-0.3-0.3-0.6-0.6-0.7C23,2.5,20.5,3,18.8,4.7c-1.5,1.5-2.1,3.7-1.5,5.8l-6.8,6.8c-2.1-0.6-4.3,0-5.8,1.5
              C3,20.5,2.5,23,3.3,25.3c0.1,0.3,0.4,0.5,0.7,0.6c0.3,0.1,0.7,0,0.9-0.3l2-2l1.1,0.3L8.4,25l-2,2c-0.2,0.2-0.3,0.6-0.3,0.9
              c0.1,0.3,0.3,0.6,0.6,0.7c0.7,0.3,1.5,0.4,2.2,0.4c1.6,0,3.1-0.6,4.2-1.8c1.5-1.5,2.1-3.7,1.5-5.8l6.8-6.8c2.1,0.6,4.3,0,5.8-1.5
              C29,11.5,29.5,9,28.7,6.7z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

SegmentationDropDownRow.propTypes = {
  servicesManager: PropTypes.object,
  segmentations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeSegmentation: PropTypes.shape({
    id: PropTypes.string.isRequired,
    isVisible: PropTypes.bool.isRequired,
  }),
  onActiveSegmentationChange: PropTypes.func.isRequired,
  disableEditing: PropTypes.bool,
  onToggleSegmentationVisibility: PropTypes.func,
  onSegmentationEdit: PropTypes.func,
  onSegmentationDownload: PropTypes.func,
  onSegmentationDownloadRTSS: PropTypes.func,
  storeSegmentation: PropTypes.func,
  onSegmentationDelete: PropTypes.func,
  onSegmentationAdd: PropTypes.func,
};

export default SegmentationDropDownRow;
