/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  type DataMask,
  type DataMaskStateWithId,
  type Filter,
  NativeFilterType,
} from '@superset-ui/core';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import { setDataMaskForFilterChangesComplete } from './actions';
import reducer from './reducer';

const filterId = 'NATIVE_FILTER-required';
const defaultDataMask: DataMask = {
  filterState: { value: ['default'], label: 'default' },
  extraFormData: {
    filters: [{ col: 'category', op: 'IN', val: ['default'] }],
  },
};

/** Build a filter with a default that restricts chart queries. */
const createFilter = (controlValues = { enableEmptyFilter: true }): Filter => ({
  id: filterId,
  name: 'Category',
  type: NativeFilterType.NativeFilter,
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'category' } }],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues,
  defaultDataMask,
  cascadeParentIds: [],
  description: '',
});

/** Hydrate a dashboard from its persisted filter mask. */
const hydrate = (filter: Filter, loadedMask?: DataMask) => {
  const dataMask: DataMaskStateWithId = loadedMask
    ? { [filterId]: { id: filterId, ...loadedMask } }
    : {};
  return reducer(
    {},
    {
      type: HYDRATE_DASHBOARD,
      data: {
        dashboardInfo: {
          metadata: { native_filter_configuration: [filter] },
        },
        dataMask,
      },
    },
  )[filterId];
};

/** Modify a filter without changing its target or configured default. */
const modifyFilter = (filter: Filter, existingMask: DataMask) =>
  reducer(
    { [filterId]: { id: filterId, ...existingMask } },
    setDataMaskForFilterChangesComplete(
      { deleted: [], reordered: [], modified: [filter] },
      { [filterId]: filter },
    ),
  )[filterId];

test.each([
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
  { label: 'empty selection', value: [] },
  { label: 'cleared range', value: [null, null] },
])('HYDRATE_DASHBOARD restores required default for $label', ({ value }) => {
  const result = hydrate(createFilter(), {
    filterState: { value },
    extraFormData: {},
  });

  expect(result.filterState).toEqual(defaultDataMask.filterState);
  expect(result.extraFormData).toEqual(defaultDataMask.extraFormData);
});

test.each([
  { label: 'absent', extraFormData: undefined },
  { label: 'empty', extraFormData: {} },
])(
  'HYDRATE_DASHBOARD restores required default when a value has $label query filters',
  ({ extraFormData }) => {
    const result = hydrate(createFilter(), {
      filterState: { value: ['incomplete selection'] },
      extraFormData,
    });

    expect(result.filterState).toEqual(defaultDataMask.filterState);
    expect(result.extraFormData).toEqual(defaultDataMask.extraFormData);
  },
);

test('HYDRATE_DASHBOARD applies the required default without a persisted mask', () => {
  const result = hydrate(createFilter());

  expect(result.filterState).toEqual(defaultDataMask.filterState);
  expect(result.extraFormData).toEqual(defaultDataMask.extraFormData);
});

test.each([
  { label: 'zero', value: 0 },
  { label: 'false', value: false },
  { label: 'lower bound only', value: [0, null] },
  { label: 'upper bound only', value: [null, 20] },
  { label: 'selected category', value: ['selected'] },
])('required filters preserve a valid $label selection', ({ value }) => {
  const filter = createFilter();
  const existingMask: DataMask = {
    filterState: { value },
    extraFormData: {
      filters: [{ col: 'category', op: 'IN', val: ['selected'] }],
    },
  };

  const hydrated = hydrate(filter, existingMask);
  const modified = modifyFilter(filter, existingMask);

  expect(hydrated.filterState).toEqual(existingMask.filterState);
  expect(hydrated.extraFormData).toEqual(existingMask.extraFormData);
  expect(modified.filterState).toEqual(existingMask.filterState);
  expect(modified.extraFormData).toEqual(existingMask.extraFormData);
});

test('HYDRATE_DASHBOARD preserves an explicitly cleared optional filter', () => {
  const clearedMask: DataMask = {
    filterState: { value: [] },
    extraFormData: {},
  };
  const result = hydrate(
    createFilter({ enableEmptyFilter: false }),
    clearedMask,
  );

  expect(result.filterState).toEqual(clearedMask.filterState);
  expect(result.extraFormData).toEqual({});
});

test.each([
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
  { label: 'empty selection', value: [] },
  { label: 'cleared range', value: [null, null] },
])(
  'modifying a required filter restores its default for $label',
  ({ value }) => {
    const result = modifyFilter(createFilter(), {
      filterState: { value },
      extraFormData: {},
    });

    expect(result.filterState).toEqual(defaultDataMask.filterState);
    expect(result.extraFormData).toEqual(defaultDataMask.extraFormData);
  },
);

test('modifying a defaultToFirstItem filter preserves its pending empty state', () => {
  const filter = createFilter();
  filter.controlValues.defaultToFirstItem = true;
  const existingMask: DataMask = {
    filterState: { value: [] },
    extraFormData: {},
  };

  const result = modifyFilter(filter, existingMask);

  expect(result.filterState).toEqual(existingMask.filterState);
  expect(result.extraFormData).toEqual({});
});
