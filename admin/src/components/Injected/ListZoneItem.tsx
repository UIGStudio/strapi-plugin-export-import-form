import React, { useState, useEffect } from 'react';
import { Stack } from '@strapi/design-system/Stack';
// I18N
import { useIntl } from 'react-intl';
import getTrad from '../../utils/getTrad';
// Strapi Design System
import { Typography } from '@strapi/design-system/Typography';
import { Divider } from '@strapi/design-system/Divider';
import { Box } from '@strapi/design-system/Box';
import { Button } from '@strapi/design-system/Button';
// Context from Strapi Helper.
import { useCMEditViewDataManager } from '@strapi/helper-plugin';

export const StrapiListZoneItem = ({ strapi }) => {
  const ctx = useCMEditViewDataManager();

  const exportForm = async () => {
    try {
      console.log('Exporting from clipboard');
      const data = ctx.initialData;
      console.log(ctx);
      console.log(data);
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(json);
      console.log('Export successful');
    } catch (e) {
      console.log('Export error');
      console.error(e);
    }
  };

  const importForm = async () => {
    let updatableKeys;
    let dataToImport;
    let linkPagesRelations: { key: string; fieldData: any }[] = [];

    try {
      console.log('Importing from clipboard');
      const json = await navigator.clipboard.readText();
      dataToImport = JSON.parse(json);
      console.log(dataToImport);

      updatableKeys = ctx.updateActionAllowedFields as string[];
    } catch (e) {
      console.log('Data in clipboard invalid');
      console.error(e);
    }

    const recursiveImport = (
      level: string[],
      data: Record<string, any>
    ): void => {
      try {
        console.log('Importing', level, data);

        (Object.entries(data) as [string, any][]).forEach(
          ([field, fieldData]) => {
            let key = [...level, field].join('.');

            if (
              (typeof field === 'string' &&
                level.every((leave) => typeof leave === 'string') &&
                !updatableKeys.some((item) =>
                  key.startsWith(item)
                )) ||
              ['id', 'vuid'].includes(field)
            ) {
              console.log('Object field not updatable', key);
              return;
            }

            if (
              fieldData !== null &&
              typeof fieldData === 'object' &&
              Object.keys(fieldData).length > 0
            ) {
              if (
                'related' in fieldData &&
                'updatedBy' in fieldData &&
                'alternativeText' in fieldData
              ) {
                console.log('Setting image', key, fieldData);
                ctx.onChange({
                  target: { name: key, value: fieldData },
                });

                return;
              }

              if (
                'url' in fieldData &&
                'target' in fieldData &&
                'page' in fieldData
              ) {
                console.log('Setting link', key, fieldData);

                if (fieldData.page) {
                  ctx.onChange({
                    target: {
                      name: key,
                      value: {
                        ...fieldData,
                        page: {
                          // This will prevent submitting the form by throwing server error
                          // until all relations are resolved by the user
                          id: `Select stg page ${fieldData.page.id}`,
                        },
                      },
                    },
                  });
                  linkPagesRelations.push({ key, fieldData });
                } else {
                  ctx.onChange({
                    target: { name: key, value: fieldData },
                  });
                }
                return;
              }
              // console.log(
              //   'Adding component',
              //   key,
              //   fieldData.__component
              // );
              // ctx.addComponentToDynamicZone(
              //   key,
              //   fieldData.__component
              // );
              // Object
              recursiveImport([...level, field], fieldData);
              return;
            }

            if (
              fieldData !== null &&
              typeof fieldData === 'object' &&
              fieldData.length !== undefined
            ) {
              // Array
              if (typeof [...level].pop() === 'number') {
                console.log('Adding list item', key);
                ctx.addRepeatableComponentToField(key);
              } else {
                console.log('Adding component', key);
                ctx.addComponentToDynamicZone(key);
              }

              fieldData.forEach((listItem, index) =>
                recursiveImport([...level, field, index], listItem)
              );
              return;
            }

            if (typeof fieldData !== 'object' || fieldData === null) {
              console.log('Setting field value', key, fieldData);
              ctx.onChange({
                target: { name: key, value: fieldData },
              });
              return;
            }
          }
        );
      } catch (e) {
        console.log('Failed to import', level.join('.'), data);
        console.error(e);
      }
    };

    recursiveImport([], dataToImport);
  };

  return (
    <Box
      background="neutral0"
      hasRadius
      shadow="filterShadow"
      paddingTop={6}
      paddingBottom={4}
      paddingLeft={3}
      paddingRight={3}
    >
      <Typography variant="sigma" textColor="neutral600">
        {'Export Import Form by UIG'}
      </Typography>
      <Box>
        <Divider />
      </Box>
      <Stack spacing={2} paddingTop={3}>
        <Button onClick={exportForm}>{'Export to clipboard'}</Button>
        <Button onClick={importForm} variant="danger">
          {'Import from clipboard'}
        </Button>
      </Stack>
    </Box>
  );
};
