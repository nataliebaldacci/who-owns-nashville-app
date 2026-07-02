<script>
	import { Checkbox, Label, useId } from "bits-ui";
	let {
		id = useId(),
		checked = $bindable(false),
		size = "default", // "default" | "sm"
		labelText,
		labelPosition = "right", // "right" | "left" | "top" | "bottom"
		class: className,
		...restProps
	} = $props();
</script>

<div class="bits-checkbox" data-label-position={labelPosition} data-size={size}>
	<Checkbox.Root {id} class={className} {...restProps} bind:checked />
	{#if labelText}
		<Label.Root for={id}>{labelText}</Label.Root>
	{/if}
</div>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
