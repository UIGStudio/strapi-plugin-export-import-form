import React, {
  useState,
  useEffect,
  useRef,
  ComponentProps,
} from 'react';
// Context from Strapi Helper.
import { useCMEditViewDataManager } from '@strapi/helper-plugin';
import { auth } from '@strapi/helper-plugin';
// Strapi Design System
import { Stack } from '@strapi/design-system/Stack';
import { Typography } from '@strapi/design-system/Typography';
import { Divider } from '@strapi/design-system/Divider';
import { Box } from '@strapi/design-system/Box';
import { Button } from '@strapi/design-system/Button';
import { Loader } from '@strapi/design-system/Loader';
import { Alert } from '@strapi/design-system/Alert';
import { Portal } from '@strapi/design-system/Portal';
import { Flex } from '@strapi/design-system/Flex';
import { Switch } from '@strapi/design-system/Switch';
import ExclamationMarkCircle from '@strapi/icons/ExclamationMarkCircle';
import DownloadIcon from '@strapi/icons/Download';
import UploadIcon from '@strapi/icons/Upload';
import {
  Dialog,
  DialogBody,
  DialogFooter,
} from '@strapi/design-system/Dialog';
import './style.css';

const emptyArray = [];

type KeyType = (string | number)[];

export const StrapiListZoneItem = ({ strapi }) => {
  const ctx = useCMEditViewDataManager();

  const [state, setState] = useState<
    null | 'inProgress' | 'success' | 'error'
  >(null);

  const shouldTriggerValidation = useRef(false);
  const pagesStore = useRef<
    Record<'source' | 'destination', any[] | null | undefined>
  >({ source: null, destination: null });
  const [unmatchedPageRelations, setUnmatchedPageRelations] =
    useState<{ key: KeyType; data: any }[]>(emptyArray);
  const [matchPageRelations, setMatchPageRelations] = useState(true);
  const [useExistingAssets, setUseExistingAssets] = useState(true);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
    useState<Boolean>(false);
  const [clipboardContents, setClipboardContents] = useState<
    string | null
  >(null);

  const existingAssets = useRef<Record<string, any>[] | null>();

  const fetchPages = async (locale: string) => {
    try {
      console.log('Fetching pages');
      const response = await fetch(
        `/content-manager/collection-types/api::page.page?page=1&pageSize=10000${
          locale ? `&locale=${locale}` : ''
        }`,
        {
          headers: {
            Authorization: `Bearer ${auth.getToken()}`,
          },
        }
      );

      const pages = JSON.parse(await response.text()).results;
      console.log(`Found ${pages.length} pages`, pages);
      return pages.map(
        ({
          createdAt,
          id,
          isVisibleInListView,
          publishedAt,
          seo,
          updatedAt,
          versions,
          versionNumber,
          vuid,
          title,
        }) => ({
          createdAt,
          id,
          isVisibleInListView,
          publishedAt,
          seo,
          updatedAt,
          versions,
          versionNumber,
          vuid,
          title,
        })
      );
    } catch (e) {
      console.log(
        'Could not fetch the list of pages, link relation matching unavailable'
      );
      console.error(e);
    }
  };

  const exportForm = async () => {
    try {
      setState('inProgress');
      console.log('Exporting from clipboard');
      console.log(ctx);
      const formData = ctx.initialData;
      console.log(formData);
      let pages;
      if (matchPageRelations) {
        pages = await fetchPages(formData.locale);
      }
      const dataToExport = {
        formData,
        pages,
      };
      await navigator.clipboard.writeText(
        JSON.stringify(dataToExport, null, 2)
      );
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
      if (
        matchPageRelations &&
        pagesStore.current.source?.length &&
        pagesStore.current.destination?.length
      ) {
        const sourcePage = pagesStore.current.source.find(
          (page) => page.id === link.page.id
        );

        if (sourcePage) {
          const matchedPage = pagesStore.current.destination.find(
            (page) =>
              page.title && sourcePage.title
                ? page.title === sourcePage.title
                : page.seo?.title && sourcePage.seo?.title
                ? page.seo.title === sourcePage.seo.title
                : false
          );

          if (matchedPage) {
            console.log(
              `Found equivalent page for #${sourcePage.id} ${
                sourcePage.title || sourcePage.seo?.title
              }`,
              sourcePage,
              matchedPage
            );
            return {
              ...link,
              page: {
                id: matchedPage.id,
                vuid: matchedPage.vuid,
                versionNumber: matchedPage.versionNumber,
                createdAt: matchedPage.createdAt,
                updatedAt: matchedPage.updatedAt,
                publishedAt: matchedPage.publishedAt,
                isVisibleInListView: matchedPage.isVisibleInListView,
              },
            };
          } else {
            console.log(
              `Page equivalent to #${sourcePage.id} ${
                sourcePage.title || sourcePage.seo?.title
              } could not be found here`,
              sourcePage,
              pagesStore.current
            );
          }
        } else {
          console.warn(
            'Could not found source page for id',
            link.page.id,
            link,
            pagesStore.current.source
          );
        }
      }

      // Unmatched page relation or matching disabled

      setUnmatchedPageRelations((current) => [
        ...current,
        { key, data: link },
      ]);
      return {
        ...link,
        page: {
          // This will prevent submitting the form by throwing server error
          // until all relations are resolved by a human
          id: `Select page equivalent to source id ${link.page.id}`,
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
      console.log('Importing from clipboard');
      setUnmatchedPageRelations(emptyArray);
      existingAssets.current = null;
      const { formData, pages } = JSON.parse(clipboardContents!);
      console.log({ formData, pages });

      if (
        formData.locale &&
        ctx.initialData.locale &&
        formData.locale !== ctx.initialData.locale
      ) {
        throw new Error(
          `Current locale ${ctx.initialData.locale} does not match source locale ${formData.locale}. Create a new entry with correct locale.`
        );
      }

      if (matchPageRelations) {
        pagesStore.current.source = pages;
        pagesStore.current.destination = await fetchPages(
          formData.locale
        );
      }

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

          // console.log(
          //   `Found ${existingAssets.current!.length} existing assets`,
          //   existingAssets.current
          // );
        } catch (e) {
          console.log('Failed to fetch existing assets');
          console.error(e);
        }
      }

      await Promise.all(
        Object.keys(formData)
          .filter((key) => updatableTopLevelKeys.has(key))
          .map(async (key) => {
            try {
              const data = await prepareData(formData[key], [key]);
              console.log(`Importing ${key}`, data);
              ctx.onChange({ target: { name: key, value: data } });
            } catch (e) {
              console.log('Import error', key);
              console.error(e);
            }
          })
      );

      shouldTriggerValidation.current = true;
      pages.current = { source: null, destination: null };
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
        `${unmatchedPageRelations?.length}} page relations need to be set manually`,
        unmatchedPageRelations
      );

      ctx.triggerFormValidation();
      ctx.checkFormErrors();

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
        {'Export Import Form BETA by UIG'}
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
            <Flex gap={1}>
              <Switch
                selected={matchPageRelations}
                onChange={() =>
                  setMatchPageRelations((current) => !current)
                }
              />
              <Typography variant="sigma" textColor="neutral600">
                {'Attempt to match link page relations'}
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

            {unmatchedPageRelations.length ? (
              <>
                <Box paddingTop={5} paddingBottom={2}>
                  <Divider />
                </Box>
                <Typography variant="sigma" textColor="danger600">
                  {`There are ${unmatchedPageRelations.length} page relations that require human intervention:`}
                </Typography>
                <Stack spacing={1}>
                  {unmatchedPageRelations.map(({ key, data }) => (
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
