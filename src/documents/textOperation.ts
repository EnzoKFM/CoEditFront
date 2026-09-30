export type Component = { retain: number } | { insert: string } | { delete: number }
export type TextOperation = Component[]

export class InvalidOperationError extends Error {}

function isRetain(component: Component | undefined): component is { retain: number } {
    return component !== undefined && 'retain' in component;
}

function isInsert(component: Component | undefined): component is { insert: string } {
    return component !== undefined && 'insert' in component;
}

function isDelete(component: Component | undefined): component is { delete: number } {
    return component !== undefined && 'delete' in component;
}

function getComponentLength(component: Component) {
    if (isInsert(component)) {
        return component.insert.length;
    }
    return isRetain(component) ? component.retain : component.delete;
}

function shortenComponent(component: Component, consumedLength: number): Component | undefined {
    const remainingLength = getComponentLength(component) - consumedLength;
    if (remainingLength === 0) {
        return undefined;
    }
    return isRetain(component) ? { retain: remainingLength } : { delete: remainingLength };
}

function createOperationBuilder() {
    const components: TextOperation = [];

    return {
        retain(length: number) {
            if (length <= 0) {
                return;
            }
            const lastComponent = components.at(-1);
            if (isRetain(lastComponent)) {
                lastComponent.retain += length;
            } else {
                components.push({ retain: length });
            }
        },

        insert(text: string) {
            if (text.length === 0) {
                return;
            }
            const lastComponent = components.at(-1);
            const componentBeforeLast = components.at(-2);
            if (isInsert(lastComponent)) {
                lastComponent.insert += text;
            } else if (isDelete(lastComponent) && isInsert(componentBeforeLast)) {
                componentBeforeLast.insert += text;
            } else if (isDelete(lastComponent)) {
                components.splice(components.length - 1, 0, { insert: text });
            } else {
                components.push({ insert: text });
            }
        },

        delete(length: number) {
            if (length <= 0) {
                return;
            }
            const lastComponent = components.at(-1);
            if (isDelete(lastComponent)) {
                lastComponent.delete += length;
            } else {
                components.push({ delete: length });
            }
        },

        build() {
            return components;
        },
    };
}

export function getBaseLength(operation: TextOperation) {
    let baseLength = 0;
    for (const component of operation) {
        if (!isInsert(component)) {
            baseLength += getComponentLength(component);
        }
    }
    return baseLength;
}

export function applyOperation(content: string, operation: TextOperation): string {
    if (getBaseLength(operation) !== content.length) {
        throw new InvalidOperationError("La longueur de base de l'opération ne correspond pas au document");
    }

    const contentParts = [];
    let contentPosition = 0;
    for (const component of operation) {
        if (isRetain(component)) {
            contentParts.push(content.slice(contentPosition, contentPosition + component.retain));
            contentPosition += component.retain;
        } else if (isInsert(component)) {
            contentParts.push(component.insert);
        } else {
            contentPosition += component.delete;
        }
    }
    return contentParts.join('');
}

export function transformOperation(priorityOperation: TextOperation, concurrentOperation: TextOperation): [TextOperation, TextOperation] {
    if (getBaseLength(priorityOperation) !== getBaseLength(concurrentOperation)) {
        throw new InvalidOperationError('Les deux opérations ne partent pas du même document');
    }

    const transformedPriorityBuilder = createOperationBuilder();
    const transformedConcurrentBuilder = createOperationBuilder();
    let priorityIndex = 0;
    let concurrentIndex = 0;
    let priorityComponent = priorityOperation[priorityIndex++];
    let concurrentComponent = concurrentOperation[concurrentIndex++];

    while (priorityComponent !== undefined || concurrentComponent !== undefined) {
        if (isInsert(priorityComponent)) {
            transformedPriorityBuilder.insert(priorityComponent.insert);
            transformedConcurrentBuilder.retain(priorityComponent.insert.length);
            priorityComponent = priorityOperation[priorityIndex++];
            continue;
        }

        if (isInsert(concurrentComponent)) {
            transformedPriorityBuilder.retain(concurrentComponent.insert.length);
            transformedConcurrentBuilder.insert(concurrentComponent.insert);
            concurrentComponent = concurrentOperation[concurrentIndex++];
            continue;
        }

        const consumedLength = Math.min(getComponentLength(priorityComponent), getComponentLength(concurrentComponent));
        if (isRetain(priorityComponent) && isRetain(concurrentComponent)) {
            transformedPriorityBuilder.retain(consumedLength);
            transformedConcurrentBuilder.retain(consumedLength);
        } else if (isDelete(priorityComponent) && isRetain(concurrentComponent)) {
            transformedPriorityBuilder.delete(consumedLength);
        } else if (isRetain(priorityComponent) && isDelete(concurrentComponent)) {
            transformedConcurrentBuilder.delete(consumedLength);
        }

        priorityComponent = shortenComponent(priorityComponent, consumedLength) ?? priorityOperation[priorityIndex++];
        concurrentComponent = shortenComponent(concurrentComponent, consumedLength) ?? concurrentOperation[concurrentIndex++];
    }

    return [transformedPriorityBuilder.build(), transformedConcurrentBuilder.build()];
}

export function transformIndex(index: number, operation: TextOperation): number {
    let basePosition = 0;
    let transformedIndex = index;
    for (const component of operation) {
        if (basePosition > index) {
            break;
        }
        if (isRetain(component)) {
            basePosition += component.retain;
        } else if (isInsert(component)) {
            transformedIndex += component.insert.length;
        } else {
            transformedIndex -= Math.min(component.delete, index - basePosition);
            basePosition += component.delete;
        }
    }
    return transformedIndex;
}
