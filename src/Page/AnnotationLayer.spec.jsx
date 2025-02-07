import { beforeAll, describe, expect, it } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

import { pdfjs } from '../index.test';

import AnnotationLayer from './AnnotationLayer';
import LinkService from '../LinkService';

import failingPage from '../../__mocks__/_failing_page';

import { loadPDF, makeAsyncCallback, muteConsole, restoreConsole } from '../../test-utils';

import DocumentContext from '../DocumentContext';
import PageContext from '../PageContext';

const pdfFile = loadPDF('./__mocks__/_pdf.pdf');
const annotatedPdfFile = loadPDF('./__mocks__/_pdf3.pdf');

function renderWithContext(children, documentContext, pageContext) {
  const { rerender, ...otherResult } = render(
    <DocumentContext.Provider value={documentContext}>
      <PageContext.Provider value={pageContext}>{children}</PageContext.Provider>
    </DocumentContext.Provider>,
  );

  return {
    ...otherResult,
    rerender: (
      nextChildren,
      nextDocumentContext = documentContext,
      nextPageContext = pageContext,
    ) =>
      rerender(
        <DocumentContext.Provider value={nextDocumentContext}>
          <PageContext.Provider value={nextPageContext}>{nextChildren}</PageContext.Provider>
        </DocumentContext.Provider>,
      ),
  };
}

describe('AnnotationLayer', () => {
  const linkService = new LinkService();

  // Loaded page
  let page;
  let page2;

  // Loaded page text items
  let desiredAnnotations;
  let desiredAnnotations2;

  beforeAll(async () => {
    const pdf = await pdfjs.getDocument({ data: pdfFile.arrayBuffer }).promise;

    page = await pdf.getPage(1);
    desiredAnnotations = await page.getAnnotations();

    page2 = await pdf.getPage(2);
    desiredAnnotations2 = await page2.getAnnotations();
  });

  describe('loading', () => {
    it('loads annotations and calls onGetAnnotationsSuccess callback properly', async () => {
      const { func: onGetAnnotationsSuccess, promise: onGetAnnotationsSuccessPromise } =
        makeAsyncCallback();

      renderWithContext(<AnnotationLayer />, { linkService }, { onGetAnnotationsSuccess, page });

      expect.assertions(1);

      await expect(onGetAnnotationsSuccessPromise).resolves.toMatchObject(desiredAnnotations);
    });

    it('calls onGetAnnotationsError when failed to load annotations', async () => {
      const { func: onGetAnnotationsError, promise: onGetAnnotationsErrorPromise } =
        makeAsyncCallback();

      muteConsole();

      renderWithContext(
        <AnnotationLayer />,
        { linkService },
        {
          onGetAnnotationsError,
          page: failingPage,
        },
      );

      expect.assertions(1);

      await expect(onGetAnnotationsErrorPromise).resolves.toBeInstanceOf(Error);

      restoreConsole();
    });

    it('replaces annotations properly when page is changed', async () => {
      const { func: onGetAnnotationsSuccess, promise: onGetAnnotationsSuccessPromise } =
        makeAsyncCallback();

      const { rerender } = renderWithContext(
        <AnnotationLayer />,
        { linkService },
        {
          onGetAnnotationsSuccess,
          page,
        },
      );

      expect.assertions(2);

      await expect(onGetAnnotationsSuccessPromise).resolves.toMatchObject(desiredAnnotations);

      const { func: onGetAnnotationsSuccess2, promise: onGetAnnotationsSuccessPromise2 } =
        makeAsyncCallback();

      rerender(
        <AnnotationLayer />,
        { linkService },
        {
          onGetAnnotationsSuccess: onGetAnnotationsSuccess2,
          page: page2,
        },
      );

      await expect(onGetAnnotationsSuccessPromise2).resolves.toMatchObject(desiredAnnotations2);
    });

    it('throws an error when placed outside Page', () => {
      muteConsole();

      expect(() => renderWithContext(<AnnotationLayer />)).toThrow();

      restoreConsole();
    });
  });

  describe('rendering', () => {
    it('renders annotations properly', async () => {
      const {
        func: onRenderAnnotationLayerSuccess,
        promise: onRenderAnnotationLayerSuccessPromise,
      } = makeAsyncCallback();

      const { container } = renderWithContext(
        <AnnotationLayer />,
        { linkService },
        {
          onRenderAnnotationLayerSuccess,
          page,
        },
      );

      expect.assertions(1);

      await onRenderAnnotationLayerSuccessPromise;

      const annotationItems = [...container.firstElementChild.children];

      expect(annotationItems).toHaveLength(desiredAnnotations.length);
    });

    it.each`
      externalLinkTarget | target
      ${null}            | ${''}
      ${'_self'}         | ${'_self'}
      ${'_blank'}        | ${'_blank'}
      ${'_parent'}       | ${'_parent'}
      ${'_top'}          | ${'_top'}
    `(
      'renders all links with target $target given externalLinkTarget = $externalLinkTarget',
      async ({ externalLinkTarget, target }) => {
        const {
          func: onRenderAnnotationLayerSuccess,
          promise: onRenderAnnotationLayerSuccessPromise,
        } = makeAsyncCallback();
        const customLinkService = new LinkService();
        if (externalLinkTarget) {
          customLinkService.setExternalLinkTarget(externalLinkTarget);
        }

        const { container } = renderWithContext(
          <AnnotationLayer />,
          { linkService: customLinkService },
          {
            onRenderAnnotationLayerSuccess,
            page,
          },
        );

        expect.assertions(desiredAnnotations.length);

        await onRenderAnnotationLayerSuccessPromise;

        const annotationItems = [...container.firstElementChild.children];
        const annotationLinkItems = annotationItems
          .map((item) => item.firstChild)
          .filter((item) => item.tagName === 'A');

        annotationLinkItems.forEach((link) => expect(link.getAttribute('target')).toBe(target));
      },
    );

    it.each`
      externalLinkRel | rel
      ${null}         | ${'noopener noreferrer nofollow'}
      ${'noopener'}   | ${'noopener'}
    `(
      'renders all links with rel $rel given externalLinkRel = $externalLinkRel',
      async ({ externalLinkRel, rel }) => {
        const {
          func: onRenderAnnotationLayerSuccess,
          promise: onRenderAnnotationLayerSuccessPromise,
        } = makeAsyncCallback();
        const customLinkService = new LinkService();
        if (externalLinkRel) {
          customLinkService.setExternalLinkRel(externalLinkRel);
        }

        const { container } = renderWithContext(
          <AnnotationLayer />,
          { linkService: customLinkService },
          {
            onRenderAnnotationLayerSuccess,
            page,
          },
        );

        expect.assertions(desiredAnnotations.length);

        await onRenderAnnotationLayerSuccessPromise;

        const annotationItems = [...container.firstElementChild.children];
        const annotationLinkItems = annotationItems
          .map((item) => item.firstChild)
          .filter((item) => item.tagName === 'A');

        annotationLinkItems.forEach((link) => expect(link.getAttribute('rel')).toBe(rel));
      },
    );

    it('renders annotations with the default imageResourcesPath given no imageResourcesPath', async () => {
      const pdf = await pdfjs.getDocument({ data: annotatedPdfFile.arrayBuffer }).promise;
      const annotatedPage = await pdf.getPage(1);

      const {
        func: onRenderAnnotationLayerSuccess,
        promise: onRenderAnnotationLayerSuccessPromise,
      } = makeAsyncCallback();
      const imageResourcesPath = '';
      const desiredImageTagRegExp = new RegExp(
        `<img[^>]+src="${imageResourcesPath}annotation-note.svg"`,
      );

      const { container } = renderWithContext(
        <AnnotationLayer />,
        { linkService },
        {
          onRenderAnnotationLayerSuccess,
          page: annotatedPage,
        },
      );

      expect.assertions(1);

      await onRenderAnnotationLayerSuccessPromise;

      const stringifiedAnnotationLayerNode = container.outerHTML;

      expect(stringifiedAnnotationLayerNode).toMatch(desiredImageTagRegExp);
    });

    it('renders annotations with the specified imageResourcesPath given imageResourcesPath', async () => {
      const pdf = await pdfjs.getDocument({ data: annotatedPdfFile.arrayBuffer }).promise;
      const annotatedPage = await pdf.getPage(1);

      const {
        func: onRenderAnnotationLayerSuccess,
        promise: onRenderAnnotationLayerSuccessPromise,
      } = makeAsyncCallback();
      const imageResourcesPath = '/public/images/';
      const desiredImageTagRegExp = new RegExp(
        `<img[^>]+src="${imageResourcesPath}annotation-note.svg"`,
      );

      const { container } = renderWithContext(
        <AnnotationLayer />,
        {
          imageResourcesPath,
          linkService,
        },
        {
          onRenderAnnotationLayerSuccess,
          page: annotatedPage,
        },
      );

      expect.assertions(1);

      await onRenderAnnotationLayerSuccessPromise;

      const stringifiedAnnotationLayerNode = container.outerHTML;

      expect(stringifiedAnnotationLayerNode).toMatch(desiredImageTagRegExp);
    });
  });
});
