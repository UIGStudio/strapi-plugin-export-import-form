import React, {
  useState,
  useEffect,
  useRef,
  ComponentProps,
} from 'react';
import { Stack } from '@strapi/design-system/Stack';
// Strapi Design System
import { Typography } from '@strapi/design-system/Typography';
import { Divider } from '@strapi/design-system/Divider';
import { Box } from '@strapi/design-system/Box';
import { Button } from '@strapi/design-system/Button';
// Context from Strapi Helper.
import { useCMEditViewDataManager } from '@strapi/helper-plugin';
import { Loader } from '@strapi/design-system/Loader';
import { Alert } from '@strapi/design-system/Alert';
import { Portal } from '@strapi/design-system/Portal';
import './style.css';

const emptyArray = [];

export const StrapiListZoneItem = ({ strapi }) => {
  const ctx = useCMEditViewDataManager();

  const [state, setState] = useState<
    null | 'inProgress' | 'success' | 'error'
  >(null);

  const [linkPageRelations, setLinkpageRelations] =
    useState<{ key: (string | number)[]; data: any }[]>(emptyArray);

  const exportForm = async () => {
    try {
      setState('inProgress');
      console.log('Exporting from clipboard');
      const data = ctx.initialData;
      console.log(ctx);
      console.log(data);
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(json);
      console.log('Export successful');
      setState('success');
    } catch (e) {
      console.log('Export error');
      console.error(e);
      setState('error');
    }
  };

  const prepareData = (data: any, key: (string | number)[]) => {
    console.log('Preparing', key.join('.'));

    if (typeof data === 'object' && data !== null) {
      if (data.length !== undefined) {
        return (data as any[]).map((item, index) =>
          prepareData(item, [...key, index])
        );
      } else {
        // Object

        // Image
        if (
          'related' in data &&
          'updatedBy' in data &&
          'alternativeText' in data
        ) {
          return data;
        }

        // Link
        if ('url' in data && 'target' in data && 'page' in data) {
          if (data.page?.id) {
            // Link with relation
            setLinkpageRelations((current) => [
              ...current,
              { key, data },
            ]);
            return {
              ...data,
              page: {
                // This will prevent submitting the form by throwing server error
                // until all relations are resolved by the user
                id: `Select stg page ${data.page.id}`,
              },
            };
          } else {
            return data;
          }
        }

        return Object.fromEntries(
          (Object.entries(data) as [string, any][]).map(
            ([property, value]) => [
              property,
              prepareData(value, [...key, property]),
            ]
          )
        );
      }
    } else {
      if ([...key].pop() === 'id' && typeof data === 'number') {
        return data + 100;
      }
      return data;
    }
  };

  const importForm = async () => {
    try {
      setState('inProgress');
      console.log('Importing from clipboard');
      setLinkpageRelations(emptyArray);
      const json = await navigator.clipboard.readText();
      const dataToImport = JSON.parse(json);
      console.log(dataToImport);

      const updatableTopLevelKeys = new Set(
        (ctx.updateActionAllowedFields as string[]).map((key) =>
          key.replace(/\..+/, '')
        )
      );
      console.log('Updatable top level keys:', updatableTopLevelKeys);

      Object.keys(dataToImport)
        .filter((key) => updatableTopLevelKeys.has(key))
        .map((key) => {
          try {
            const data = prepareData(dataToImport[key], [key]);
            console.log(`Importing ${key}`, data);
            ctx.onChange({ target: { name: key, value: data } });
          } catch (e) {
            console.log('Import error', key);
            console.error(e);
          }
        });

      console.log('Import done!');
      setState('success');
    } catch (e) {
      console.log('Import error');
      console.error(e);
      setState('error');
    }
  };

  useEffect(() => {
    if (state && state !== 'inProgress') {
      const timeoutId = setTimeout(() => setState(null), 8000);

      return () => clearTimeout(timeoutId);
    }
  }, [state]);

  const alertProps: Record<
    Exclude<typeof state, null>,
    ComponentProps<typeof Alert>
  > = {
    inProgress: {
      variant: 'default',
      children: 'Operation in progress.',
    },
    error: {
      variant: 'danger',
      children: 'Operation failed. Check browser console logs.',
    },
    success: {
      variant: 'success',
      children: 'Operation completed successfully.',
    },
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
      <Box paddingTop={2} paddingBottom={6}>
        <Divider />
      </Box>
      <Stack spacing={2}>
        {state === 'inProgress' ? (
          <Loader />
        ) : (
          <>
            <Button onClick={exportForm}>
              {'Export to clipboard'}
            </Button>
            <Button onClick={importForm} variant="danger">
              {'Import from clipboard'}
            </Button>

            {linkPageRelations.length ? (
              <>
                <Typography
                  variant="sigma"
                  textColor="danger600"
                  marginTop={6}
                >
                  {`There are ${linkPageRelations.length} page relations that require human intervention:`}
                </Typography>
                <Box paddingTop={2} paddingBottom={2}>
                  <Divider />
                </Box>

                <Stack spacing={1}>
                  {linkPageRelations.map(({ key, data }) => (
                    <Typography variant="pi" textColor="neutral600">
                      {key.join('.')}
                      {': stg#'}
                      {data?.page?.id}
                    </Typography>
                  ))}
                </Stack>
              </>
            ) : null}
          </>
        )}
      </Stack>

      <Portal>
        <div className="plugin-export-import-form-alerts">
          {state && (
            <Alert
              key={state}
              {...alertProps[state]}
              title={'Export Import Form:'}
              onClose={() => setState(null)}
            />
          )}
        </div>
      </Portal>
    </Box>
  );
};
