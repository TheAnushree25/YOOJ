import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * One pointer listener for the page, shared by the cursor and the WebGL field.
 *
 * Both want the same two numbers every frame, and two listeners writing two
 * copies of the same state is how they drift apart. Values are normalised 0..1
 * so the shader can use them directly and the cursor can scale them back up.
 */
export function usePointer() {
  const x = ref(0.5);
  const y = ref(0.5);
  const px = ref(0);
  const py = ref(0);
  const down = ref(false);
  const fine = ref(true);

  const onMove = (event: PointerEvent) => {
    px.value = event.clientX;
    py.value = event.clientY;
    x.value = event.clientX / window.innerWidth;
    y.value = 1 - event.clientY / window.innerHeight;
  };

  const onDown = () => (down.value = true);
  const onUp = () => (down.value = false);

  onMounted(() => {
    fine.value = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
  });

  return { x, y, px, py, down, fine };
}
