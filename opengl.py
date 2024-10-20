import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLU import *

def draw_square_room():
    glBegin(GL_LINES)
    glColor3f(1, 1, 1)  # White color
    
    room_size = 5
    
    # Floor
    for i in range(-room_size, room_size + 1):
        glVertex3f(i, -room_size, -room_size)
        glVertex3f(i, -room_size, room_size)
        glVertex3f(-room_size, -room_size, i)
        glVertex3f(room_size, -room_size, i)
    
    # Ceiling
    for i in range(-room_size, room_size + 1):
        glVertex3f(i, room_size, -room_size)
        glVertex3f(i, room_size, room_size)
        glVertex3f(-room_size, room_size, i)
        glVertex3f(room_size, room_size, i)
    
    # Walls
    for i in range(-room_size, room_size + 1):
        # Left wall
        glVertex3f(-room_size, -room_size, i)
        glVertex3f(-room_size, room_size, i)
        glVertex3f(-room_size, i, -room_size)
        glVertex3f(-room_size, i, room_size)
        
        # Right wall
        glVertex3f(room_size, -room_size, i)
        glVertex3f(room_size, room_size, i)
        glVertex3f(room_size, i, -room_size)
        glVertex3f(room_size, i, room_size)
        
        # Back wall
        glVertex3f(-room_size, i, -room_size)
        glVertex3f(room_size, i, -room_size)
        glVertex3f(i, -room_size, -room_size)
        glVertex3f(i, room_size, -room_size)
    
    glEnd()

def main():
    pygame.init()
    display = (800, 800)  # Square window for better symmetry
    pygame.display.set_mode(display, DOUBLEBUF | OPENGL)
    
    gluPerspective(45, (display[0] / display[1]), 0.1, 50.0)
    glTranslatef(0.0, 0.0, -15)  # Moved back to see the entire room
    
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
        
#         glRotatef(0.1, 0, 1, 0)  # Slow rotation for effect
        
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        draw_square_room()
        pygame.display.flip()
        pygame.time.wait(10)

if __name__ == "__main__":
    main()
