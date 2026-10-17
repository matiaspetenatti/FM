// Atributos VISIBLES en el juego (los ocultos y la personalidad quedan afuera a propósito)
const ATTRIBUTE_GROUPS = [
    {
        title: 'Técnicos',
        attrs: [
            { key: 'corners', label: 'Córners' },
            { key: 'crossing', label: 'Centros' },
            { key: 'dribbling', label: 'Regate' },
            { key: 'finishing', label: 'Definición' },
            { key: 'first_touch', label: 'Primer toque' },
            { key: 'free_kick_taking', label: 'Tiros libres' },
            { key: 'heading', label: 'Cabeceo' },
            { key: 'long_shots', label: 'Tiros lejanos' },
            { key: 'long_throws', label: 'Saques largos' },
            { key: 'marking', label: 'Marcaje' },
            { key: 'passing', label: 'Pase' },
            { key: 'penalty_taking', label: 'Penales' },
            { key: 'tackling', label: 'Entradas' },
            { key: 'technique', label: 'Técnica' },
        ],
    },
    {
        title: 'Mentales',
        attrs: [
            { key: 'aggression', label: 'Agresividad' },
            { key: 'anticipation', label: 'Anticipación' },
            { key: 'bravery', label: 'Valentía' },
            { key: 'composure', label: 'Sangre fría' },
            { key: 'concentration', label: 'Concentración' },
            { key: 'decisions', label: 'Decisiones' },
            { key: 'determination', label: 'Determinación' },
            { key: 'flair', label: 'Desequilibrio' },
            { key: 'leadership', label: 'Liderazgo' },
            { key: 'off_the_ball', label: 'Desmarque' },
            { key: 'positioning', label: 'Colocación' },
            { key: 'teamwork', label: 'Trabajo en equipo' },
            { key: 'vision', label: 'Visión' },
            { key: 'work_rate', label: 'Capacidad de trabajo' },
        ],
    },
    {
        title: 'Físicos',
        attrs: [
            { key: 'acceleration', label: 'Aceleración' },
            { key: 'agility', label: 'Agilidad' },
            { key: 'balance', label: 'Equilibrio' },
            { key: 'jumping_reach', label: 'Salto' },
            { key: 'natural_fitness', label: 'Estado físico natural' },
            { key: 'pace', label: 'Velocidad' },
            { key: 'stamina', label: 'Resistencia' },
            { key: 'strength', label: 'Fuerza' },
        ],
    },
    {
        title: 'Portero',
        attrs: [
            { key: 'aerial_reach', label: 'Alcance aéreo' },
            { key: 'command_of_area', label: 'Dominio del área' },
            { key: 'communication', label: 'Comunicación' },
            { key: 'eccentricity', label: 'Excentricidad' },
            { key: 'handling', label: 'Manejo' },
            { key: 'kicking', label: 'Saque' },
            { key: 'one_on_ones', label: 'Mano a mano' },
            { key: 'punching', label: 'Despeje con puños' },
            { key: 'reflexes', label: 'Reflejos' },
            { key: 'rushing_out', label: 'Salidas' },
            { key: 'throwing', label: 'Lanzamiento' },
        ],
    },
];

const FEET = [
    { key: 'left_foot', label: 'Pie izquierdo' },
    { key: 'right_foot', label: 'Pie derecho' },
];

// Lista plana de columnas que main.js puede pedir a la base
const ATTRIBUTE_COLUMNS = [
    ...ATTRIBUTE_GROUPS.flatMap((g) => g.attrs.map((a) => a.key)),
    ...FEET.map((f) => f.key),
];

// En Node (main.js) se exporta; en la ventana este bloque no hace nada
if (typeof module !== 'undefined') {
    module.exports = { ATTRIBUTE_COLUMNS };
}