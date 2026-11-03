import { useSyncExternalStore } from "react";
import { readQueue, subscribeQueue } from "./storeQueue";

/** The products sent by the Express extension, waiting to be added (they live in this browser). */
export const useStoreQueue = () => useSyncExternalStore(subscribeQueue, readQueue, readQueue);
