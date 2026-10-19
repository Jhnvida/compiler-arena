
export const PRESET_HUNTER = `// Robô Hunter de Referência (Especificação Oficial do Professor)
robot Hunter {
    int distancia;
    
    scan();
    if (enemy.visible) {
        distancia = enemy.distance;
        rotate(enemy.direction);
        if (distancia < 120) {
            fire(3);
        } else {
            fire(1);
            move(20);
        }
    } else {
        rotate(30);
        move(15);
    }
}
`;

export const PRESET_SNIPER = `// Robô Sniper Scout: Varredura contínua e disparos de longa distância
robot SniperScout {
    scan();
    if (enemy.visible) {
        rotate(enemy.direction);
        if (enemy.distance > 150) {
            fire(2);
        } else {
            fire(3);
            back(15);
        }
    } else {
        rotate(45);
    }
}
`;

export const PRESET_STRIKER = `// Robô Aggressive Striker: Avança em direção ao alvo e atira com potência máxima
robot AggressiveStriker {
    scan();
    if (enemy.visible) {
        rotate(enemy.direction);
        move(25);
        fire(3);
    } else {
        move(30);
        rotate(60);
    }
}
`;

export const PRESET_PATROL = `// Robô Wandering Patrol: Patrulha e navega pelo mapa
robot WanderingPatrol {
    int steps;
    steps = steps + 1;
    
    scan();
    if (enemy.visible) {
        rotate(enemy.direction);
        fire(2);
    } else {
        if (steps % 4 == 0) {
            rotate(90);
        }
        move(15);
    }
}
`;

export const PRESET_OPTIMIZATION_DEMO = `// Exemplo para demonstração de otimizações (Constant Folding + Simplificação Algébrica + Dead Code)
robot OptDemo {
    int constantFold = 10 + 20 * 2;   // Dobrado para 50
    int algebraicX = constantFold * 1 + 0; // Simplificado para constantFold
    int zeroMul = algebraicX * 0;     // Simplificado para 0
    
    if (false) {
        // Bloco inalcançável: eliminado pelo otimizador de código
        move(999);
        fire(3);
    } else {
        move(algebraicX);
        fire(2);
    }
}
`;

export const PRESET_ERRORS_DEMO = `// Exemplo didático com múltiplos erros para demonstrar diagnósticos
robot BuggyTank {
    int energy = 100;     // ERRO: Nome reservado de sensor
    int speed = 5;
    int speed = 10;       // ERRO: Declaração duplicada
    
    move(false);          // ERRO: Argumento booleano em vez de numérico
    fire(10);             // ERRO: Potência fora do intervalo [1, 3]
    enemy.visible = true; // ERRO: Sensores são somente leitura
    enemy = 123;          // ERRO: Modificação de sensor
}
`;
