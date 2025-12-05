// Ported from index.html Player.draw
export function drawPlayer(ctx: CanvasRenderingContext2D, player: any, x: number, y: number, facingRight: boolean = true) {
    // If player data is missing (e.g. mock), use defaults
    const girth = player.stats?.girth || 1.0;
    const skinColor = player.stats?.skinColor || '#ffdbac';
    const shirtColor = player.stats?.shirtColor || '#ffffff';
    const hatColor = player.stats?.hatColor || '#000000';

    const dir = facingRight ? 1 : -1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 10 * girth, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Circle based on girth)
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.arc(x, y - 15, 12 * girth, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(x, y - 32, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    ctx.fillStyle = hatColor;
    ctx.beginPath();
    ctx.arc(x, y - 35, 8.5, Math.PI, 0); // Top half
    ctx.fillRect(x - 9, y - 36, 18, 5); // Brim base
    // Bill
    ctx.fillRect(x + (5 * dir), y - 34, 10 * dir, 3);
    ctx.fill();

    // Bat (Simple line for now if batting)
    // To do: Add proper bat state
}
