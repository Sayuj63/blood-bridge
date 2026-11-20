import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL } from "../../../../shared/domain";

export const GROUP_OPTIONS = BLOOD_GROUPS.map((g) => ({ value: g, label: g }));
export const COMPONENT_OPTIONS = COMPONENTS.map((c) => ({ value: c, label: COMPONENT_LABEL[c] }));
