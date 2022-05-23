/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepEqual, ok, strictEqual } from 'assert';
import { ValidationStatus } from 'vs/base/common/parsers';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ApplyToKind, INamedProblemMatcher } from 'vs/workbench/contrib/tasks/common/problemMatcher';
import { ConfiguringTask, CustomTask, Globals, IParseContext, IProblemReporter, ITaskParseResult, ProblemMatcherConverter, TaskConfigSource, TaskParser, UUIDMap } from 'vs/workbench/contrib/tasks/common/taskConfiguration';
import { TaskDefinition } from 'vs/workbench/contrib/tasks/common/tasks';

class TestParseContext implements Partial<IParseContext> {
}

class TestNamedProblemMatcher implements Partial<INamedProblemMatcher> {
}

interface ITestProblemReporter extends IProblemReporter {
}

class TestProblemReporter implements ITestProblemReporter {
	private _message: string | undefined;
	public get message(): string | undefined { return this._message; }
	clearMessage(): void {
		this._message = undefined;
	}
	info(message: string): void {
		this._message = message;
	}
	warn(message: string): void {
		this._message = message;
	}
	error(message: string): void {
		this._message = message;
	}
	fatal(message: string): void {
		this._message = message;
	}
	status: ValidationStatus = new ValidationStatus();
}


suite.only('Task Configuration Test', () => {
	let instantiationService: TestInstantiationService;
	let parseContext: IParseContext;
	let namedProblemMatcher: INamedProblemMatcher;
	let problemReporter: TestProblemReporter;
	setup(() => {
		instantiationService = new TestInstantiationService();
		namedProblemMatcher = instantiationService.createInstance(TestNamedProblemMatcher);
		namedProblemMatcher.name = 'real';
		namedProblemMatcher.label = 'real label';
		problemReporter = new TestProblemReporter();
		parseContext = instantiationService.createInstance(TestParseContext);
		parseContext.problemReporter = problemReporter;
		parseContext.namedProblemMatchers = {
			'real': namedProblemMatcher
		};
		parseContext.uuidMap = new UUIDMap();
	});
	suite('ProblemMatcherConverter', () => {
		test('returns [] and an error for an unknown problem matcher', () => {
			const result = (ProblemMatcherConverter.from('$fake', parseContext));
			deepEqual(result.value, []);
			strictEqual(result.errors?.length, 1);
		});
		test('returns config for a known problem matcher', () => {
			const result = (ProblemMatcherConverter.from('$real', parseContext));
			strictEqual(result.errors?.length, 0);
			deepEqual(result.value, [{ "label": "real label" }]);
		});
		test('returns config for a known problem matcher including applyTo', () => {
			namedProblemMatcher.applyTo = ApplyToKind.closedDocuments;
			const result = (ProblemMatcherConverter.from('$real', parseContext));
			strictEqual(result.errors?.length, 0);
			deepEqual(result.value, [{ "label": "real label", "applyTo": ApplyToKind.closedDocuments }]);
		});
	});
	suite('TaskParser from', () => {
		suite('CustomTask', () => {
			suite('incomplete config reports an appropriate error for missing', () => {
				test('name', () => {
					const result = TaskParser.from([{} as CustomTask], {} as Globals, parseContext, {} as TaskConfigSource);
					assertTaskParseResult(result, undefined, problemReporter, 'Error: a task must provide a label property');
				});
				test('command', () => {
					const result = TaskParser.from([{ taskName: 'task' } as CustomTask], {} as Globals, parseContext, {} as TaskConfigSource);
					assertTaskParseResult(result, undefined, problemReporter, "Error: the task 'task' doesn't define a command");
				});
			});
			suite('returns expected result', () => {
				test('single', () => {
					const expected = [{ taskName: 'task', command: 'echo test' } as CustomTask];
					const result = TaskParser.from(expected, {} as Globals, parseContext, {} as TaskConfigSource);
					assertTaskParseResult(result, { custom: expected }, problemReporter, undefined);
				});
				test('multiple', () => {
					const expected = [{ taskName: 'task', command: 'echo test' } as CustomTask, { taskName: 'task 2', command: 'echo test' } as CustomTask];
					const result = TaskParser.from(expected, {} as Globals, parseContext, {} as TaskConfigSource);
					assertTaskParseResult(result, { custom: expected }, problemReporter, undefined);
				});
			});
		});
		suite('ConfiguredTask', () => {
			suite('returns expected result', () => {
				test('single', () => {
					const expected = [{ taskName: 'task', command: 'echo test', type: 'any' } as ConfiguringTask];
					const result = TaskParser.from(expected, {} as Globals, parseContext, {} as TaskConfigSource, { extensionId: 'registered', taskType: 'any', properties: {} } as TaskDefinition);
					assertTaskParseResult(result, { configured: expected }, problemReporter, undefined);
				});
				test('multiple', () => {
					const expected = [{ taskName: 'task', command: 'echo test', type: 'any' } as ConfiguringTask, { taskName: 'task 2', command: 'echo test', type: 'any' } as ConfiguringTask];
					const result = TaskParser.from(expected, {} as Globals, parseContext, {} as TaskConfigSource, { extensionId: 'registered', taskType: 'any', properties: {} } as TaskDefinition);
					assertTaskParseResult(result, { configured: expected }, problemReporter, undefined);
				});
			});
		});
	});
});

function assertTaskParseResult(actual: ITaskParseResult, expected: ITestTaskParseResult | undefined, problemReporter: TestProblemReporter, expectedMessage?: string): void {
	if (expectedMessage === undefined) {
		strictEqual(problemReporter.message, undefined);
	} else {
		ok(problemReporter.message?.includes(expectedMessage));
	}

	deepEqual(actual.custom.length, expected?.custom?.length || 0);
	deepEqual(actual.configured.length, expected?.configured?.length || 0);

	let index = 0;
	if (expected?.configured) {
		for (const taskParseResult of expected?.configured) {
			strictEqual(actual.configured[index]._label, taskParseResult.taskName);
			index++;
		}
	}
	index = 0;
	if (expected?.custom) {
		for (const taskParseResult of expected?.custom) {
			strictEqual(actual.custom[index]._label, taskParseResult.taskName);
			index++;
		}
	}

	problemReporter.clearMessage();
}

interface ITestTaskParseResult {
	custom?: Partial<CustomTask>[];
	configured?: Partial<ConfiguringTask>[];
}
