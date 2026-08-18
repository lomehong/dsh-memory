import { MemoryView } from "./MemoryView.js";
export const inject = ['slots'];
export function apply(ctx) {
    ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'memory',
        order: 20,
        label: () => '记忆',
    }, MemoryView));
}
