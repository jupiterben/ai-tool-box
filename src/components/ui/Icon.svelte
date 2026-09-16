<script module lang="ts">
  import {
    Globe,
    Settings,
    Zap,
    Layout,
    Grid,
    Code,
    Sparkles,
    MapPin,
    Image,
    Menu,
    X,
    Moon,
    Sun,
    EyeOff,
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    Eraser,
    History,
    MessageSquarePlus,
    FileText,
    PanelRight,
    ImagePlus,
    Download,
    LoaderCircle,
    Check,
    CircleAlert,
  } from '@lucide/svelte';
  const icons = {
    Globe,
    Settings,
    Zap,
    Layout,
    Grid,
    Code,
    Sparkles,
    MapPin,
    Image,
    Menu,
    X,
    Moon,
    Sun,
    EyeOff,
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    Eraser,
    History,
    MessageSquarePlus,
    FileText,
    PanelRight,
    ImagePlus,
    Download,
    LoaderCircle,
    Check,
    CircleAlert,
  };
  export type IconName = keyof typeof icons;
</script>

<script lang="ts">
  let {
    name,
    size = 20,
    color = 'currentColor',
    class: className = '',
    strokeWidth = 2,
  }: {
    name: IconName;
    size?: number | string;
    color?: string;
    class?: string;
    strokeWidth?: number;
    'aria-hidden'?: string;
  } = $props();
  const Component = $derived(icons[name]);
</script>

<Component {size} {color} class={className} {strokeWidth} aria-hidden="true" />
