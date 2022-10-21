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
import { Flex } from '@strapi/design-system/Flex';
import { auth } from '@strapi/helper-plugin';
import { Switch } from '@strapi/design-system/Switch';
import './style.css';
import ExclamationMarkCircle from '@strapi/icons/ExclamationMarkCircle';
import DownloadIcon from '@strapi/icons/Download';
import UploadIcon from '@strapi/icons/Upload';
import {
  Dialog,
  DialogBody,
  DialogFooter,
} from '@strapi/design-system/Dialog';
const emptyArray = [];

type KeyType = (string | number)[];

export const StrapiListZoneItem = ({ strapi }) => {
  const ctx = useCMEditViewDataManager();

  const [state, setState] = useState<
    null | 'inProgress' | 'success' | 'error'
  >(null);

  const [linkPageRelations, setLinkpageRelations] =
    useState<{ key: KeyType; data: any }[]>(emptyArray);
  const shouldTriggerValidation = useRef(false);

  const [useExistingAssets, setUseExistingAssets] = useState(true);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
    useState<Boolean>(false);
  const [clipboardContents, setClipboardContents] = useState<
    string | null
  >(null);

  const existingAssets = useRef<Record<string, any>[] | null>();

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

  const handleLink = async (data: any, key: KeyType) => {
    const link = {
      ...data,
      icon: await handleFile(data.icon, key),
    };

    if (link.page?.id) {
      // Link with relation
      setLinkpageRelations((current) => [
        ...current,
        { key, data: link },
      ]);
      return {
        ...link,
        page: {
          // This will prevent submitting the form by throwing server error
          // until all relations are resolved by a human
          id: `Select stg page ${link.page.id}`,
        },
      };
    } else {
      return link;
    }
  };

  const handleFile = async (data: any, key: KeyType) => {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'number') {
      // Id
      console.log('Unhandled file id', data, key);
    }

    if (useExistingAssets && existingAssets.current) {
      const identicalExistingAsset = existingAssets.current?.find(
        (file) =>
          // Matching these properties should be practically enough to check if it is identical
          // NOTE: reported size may differ depending on upload provider
          [
            'name',
            'alternativeText',
            'caption',
            'width',
            'height',
            'ext',
            'mime',
            'size',
            'folder',
          ].every((property) => file[property] === data[property])
      );

      if (identicalExistingAsset) {
        console.log(
          'Found existing asset',
          identicalExistingAsset.name,
          key
        );

        return identicalExistingAsset;
      }
    }

    try {
      console.log(
        `Fetching ${useExistingAssets ? 'new' : ''} file`,
        data.name,
        data,
        key
      );
      const response = await fetch(data.url);

      if (!response.ok) {
        throw new Error('Response not ok');
      }

      const blob = await response.blob();

      const formData = new FormData();
      formData.set('files', blob);
      const fileInfo = {
        name: data.name,
        caption: data.caption,
        alternativeText: data.alternativeText,
        folder: null,
      };
      formData.set('fileInfo', JSON.stringify(fileInfo));

      console.log('Uploading file', fileInfo.name, key);

      const uploadResponse = await fetch('/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload file failed');
      }

      const newFileData = JSON.parse(await uploadResponse.text())[0];

      console.log(
        'File import successful',
        newFileData.name,
        newFileData
      );

      return newFileData;
    } catch (e) {
      console.log('File import error', data, key);
      console.error(e);
    }

    return null;
  };

  const prepareData = async (data: any, key: KeyType) => {
    // console.log('Preparing', key.join('.'));

    if (typeof data === 'object' && data !== null) {
      if (data.length !== undefined) {
        return await Promise.all(
          (data as any[]).map(
            async (item, index) =>
              await prepareData(item, [
                ...key,
                item?.__component
                  ? `${item.__component.replace('.', '_')}#${index}`
                  : index,
              ])
          )
        );
      } else {
        // Object
        delete data.id;

        // Image
        if (
          'related' in data &&
          'updatedBy' in data &&
          'alternativeText' in data
        ) {
          return await handleFile(data, key);
        }

        // Link
        if ('url' in data && 'target' in data && 'page' in data) {
          return await handleLink(data, key);
        }

        return Object.fromEntries(
          await Promise.all(
            (Object.entries(data) as [string, any][]).map(
              async ([property, value]) => [
                property,
                await prepareData(value, [...key, property]),
              ]
            )
          )
        );
      }
    }

    return data;
  };

  const importForm = async () => {
    try {
      setState('inProgress');
      setIsConfirmDialogOpen(false);
      console.log('Importing from clipboard', clipboardContents);
      setLinkpageRelations(emptyArray);
      existingAssets.current = null;
      const dataToImport = JSON.parse(clipboardContents!);
      console.log(dataToImport);

      const updatableTopLevelKeys = new Set(
        (ctx.updateActionAllowedFields as string[]).map((key) =>
          key.replace(/\..+/, '')
        )
      );
      console.log('Updatable top level keys:', updatableTopLevelKeys);

      if (useExistingAssets) {
        try {
          console.log('Fetching existing assets');
          const response = await fetch(
            '/upload/files?page=1&pageSize=10000',
            {
              headers: {
                Authorization: `Bearer ${auth.getToken()}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error('Response not ok');
          }

          existingAssets.current = JSON.parse(
            await response.text()
          ).results;

          console.log(
            `Found ${existingAssets.current!.length} existing assets`,
            existingAssets.current
          );
        } catch (e) {
          console.log('Failed to fetch existing assets');
          console.error(e);
        }
      }

      await Promise.all(
        Object.keys(dataToImport)
          .filter((key) => updatableTopLevelKeys.has(key))
          .map(async (key) => {
            try {
              const data = await prepareData(dataToImport[key], [
                key,
              ]);
              console.log(`Importing ${key}`, data);
              ctx.onChange({ target: { name: key, value: data } });
            } catch (e) {
              console.log('Import error', key);
              console.error(e);
            }
          })
      );

      shouldTriggerValidation.current = true;
      console.log('Import done!');
      setState('success');
    } catch (e) {
      console.log('Import error');
      console.error(e);
      setState('error');
    }
  };

  useEffect(() => {
    if (shouldTriggerValidation.current) {
      console.log('Triggering validation', ctx);
      console.log(
        `${linkPageRelations?.length}} page relations need to be set manually`,
        linkPageRelations
      );

      ctx.triggerFormValidation();
      ctx.checkFormErrors();
      // @TODO. Trigger form validation in draft state. Sometimes throws
      // ctx.onPublish();

      shouldTriggerValidation.current = false;
    }
  }, [ctx]);

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
      children: (
        <Flex inline gap={1} alignItems={'flexStart'}>
          {'Operation in progress.'}
          <Loader small />
        </Flex>
      ),
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
          <Flex
            justifyContent="center"
            paddingTop={3}
            paddingBottom={5}
          >
            <Loader />
          </Flex>
        ) : (
          <>
            <Flex gap={1}>
              <Switch
                selected={useExistingAssets}
                onChange={() =>
                  setUseExistingAssets((current) => !current)
                }
              />
              <Typography variant="sigma" textColor="neutral600">
                {'Reuse existing assets if the same*'}
              </Typography>
            </Flex>
            <Button onClick={exportForm} startIcon={<DownloadIcon />}>
              {'Export to clipboard'}
            </Button>
            <Button
              onClick={async () => {
                setIsConfirmDialogOpen(true);
                setClipboardContents(
                  await navigator.clipboard.readText()
                );
              }}
              variant="danger"
              startIcon={<UploadIcon />}
            >
              {'Import from clipboard'}
            </Button>

            {linkPageRelations.length ? (
              <>
                <Box paddingTop={5} paddingBottom={2}>
                  <Divider />
                </Box>
                <Typography variant="sigma" textColor="danger600">
                  {`There are ${linkPageRelations.length} page relations that require human intervention:`}
                </Typography>
                <Stack spacing={1}>
                  {linkPageRelations.map(({ key, data }) => (
                    <Typography variant="pi" textColor="neutral600">
                      {key.join('.')}
                      {': $'}
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
        {isConfirmDialogOpen && (
          <Dialog
            onClose={() => setIsConfirmDialogOpen(false)}
            title="Confirmation"
            isOpen={isConfirmDialogOpen}
          >
            <DialogBody icon={<ExclamationMarkCircle />}>
              <Stack spacing={2}>
                <Flex alignItems="center" direction="column">
                  {clipboardContents ? (
                    <>
                      <Typography>
                        {'Are you sure you want to import this?'}
                      </Typography>
                      <Box
                        style={{
                          overflow: 'auto',
                          maxHeight: '200px',
                          maxWidth: '100%',
                          width: '100%',
                        }}
                      >
                        <Typography variant="pi">
                          <pre>{clipboardContents}</pre>
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography>
                      {'You must allow clipboard access first'}
                    </Typography>
                  )}
                </Flex>
              </Stack>
            </DialogBody>
            <DialogFooter
              startAction={
                <Button
                  onClick={() => setIsConfirmDialogOpen(false)}
                  variant="tertiary"
                >
                  {'Cancel'}
                </Button>
              }
              endAction={
                <Button
                  variant="danger-light"
                  disabled={!clipboardContents}
                  startIcon={<UploadIcon />}
                  onClick={importForm}
                >
                  {'Import'}
                </Button>
              }
            />
          </Dialog>
        )}
      </Portal>
    </Box>
  );
};
